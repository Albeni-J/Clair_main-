import { pool } from "../db.js";
import { SYSTEM_PROMPT } from "../prompts/appealPrompt.js";
import { geminiGenerateJson } from "../services/geminiClient.js";
import { safeJsonParse } from "../utils/safeJsonParse.js";
import { publishToQueue } from "../rabbit.js";
import { decryptSecret } from "../utils/cryptoKey.js";

/* =========================
   HELPERS
========================= */
async function getUserGeminiKeyOrThrow(userId) {
  const r = await pool.query(
    `SELECT gemini_api_key_enc
     FROM clair_users
     WHERE id=$1`,
    [Number(userId)]
  );

  if (r.rowCount === 0) throw new Error("User not found");

  const enc = r.rows[0]?.gemini_api_key_enc;
  if (!enc) throw new Error("Gemini API key not set");

  const key = decryptSecret(enc);
  const cleanKey = typeof key === "string" ? key.trim() : "";
  if (!cleanKey) throw new Error("Gemini key is empty after decrypt");

  return cleanKey;
}

function parseRatingOrThrow(value) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("rating must be an integer from 1 to 5");
  }

  return rating;
}

/* =========================
   JOB — вызывается воркером
========================= */
export async function analyzeAndCreateAppealJob({ userId, cid, text, rating }) {
  const uid = Number(userId);
  const channelId = Number(cid);
  const cleanText = typeof text === "string" ? text.trim() : "";
  const cleanRating = parseRatingOrThrow(rating);

  if (!uid || !channelId || cleanText.length < 2) {
    throw new Error("Invalid job payload (userId/cid/text)");
  }

  // 🔐 Ключ теперь достаём ЗДЕСЬ
  const cleanKey = await getUserGeminiKeyOrThrow(uid);

  // 1) проверяем что канал принадлежит владельцу
  const ch = await pool.query(
    `SELECT id FROM clair_channels WHERE id=$1 AND uid=$2`,
    [channelId, uid]
  );
  if (ch.rowCount === 0) throw new Error("Channel not found or not yours");

  // 2) Gemini
  const prompt = `${SYSTEM_PROMPT}\n\nВходной текст:\n${cleanText}`;

  let raw = "";
  let data = null;

  try {
    raw = await geminiGenerateJson({ prompt, aiKey: cleanKey });

    console.log("\n===== RAW FROM GEMINI =====");
    console.log(raw);
    console.log("===== END RAW =====\n");

    data = safeJsonParse(raw);

    console.log("===== PARSED DATA =====");
    console.log(data);
    console.log("===== END PARSED =====\n");
  } catch (e) {
    console.error("❌ Gemini/parse error:", e?.message || e);
    data = null;
  }

  // 3) mapping
  const appealType = data?.appeal_type ?? data?.type ?? null;
  const status = data?.status ?? "new";

  const emotionRatingNum = Number(data?.emotion_rating);
  const emotion = Number.isFinite(emotionRatingNum) ? emotionRatingNum : null;

  const anomalyType = data?.anomaly_type ?? null;
  const anomalyComment = data?.anomaly_comment ?? data?.anomaly_com ?? null;

  const aiComment =
    data?.ai_comment ??
    data?.ai_com ??
    data?.comment ??
    (raw ? raw.slice(0, 500) : null);

  const aiSolution = data?.ai_solution ?? data?.solution ?? null;

  const isAnomaly =
    typeof data?.is_anomaly === "boolean"
      ? data.is_anomaly
      : Boolean(data?.is_anomaly);

  // 4) INSERT
  const ins = await pool.query(
    `INSERT INTO clair_appeal
      (cid, rating, emotion, type, status, anomaly_type, anomaly_com, ai_com, org_com, text, is_anomaly, ai_solution)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10, $11)
     RETURNING *`,
    [
      channelId,
      cleanRating,
      emotion,
      appealType,
      status,
      anomalyType,
      anomalyComment,
      aiComment,
      cleanText,
      Boolean(isAnomaly),
      aiSolution,
    ]
  );

  return { appeal: ins.rows[0], ai: data, raw };
}

/* =========================
   INTERNAL — JWT
========================= */
export async function analyzeAndCreateAppeal(req, res) {
  try {
    const userId = req.user?.id;
    const { cid, text, rating } = req.body || {};

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!cid || !Number.isInteger(Number(cid))) {
      return res.status(400).json({ error: "cid is required (number)" });
    }

    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return res.status(400).json({ error: "text is required" });
    }

    let cleanRating;
    try {
      cleanRating = parseRatingOrThrow(rating);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    await publishToQueue({
      type: "APPEAL_ANALYZE",
      data: {
        userId: Number(userId),
        cid: Number(cid),
        text: text.trim(),
        rating: cleanRating,
      },
      createdAt: Date.now(),
    });

    return res.status(202).json({ ok: true, queued: true });
  } catch (e) {
    console.error("❌ INTERNAL QUEUE ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}

/* =========================
   EXTERNAL — NO JWT
========================= */
export async function ingestExternalAppeal(req, res) {
  try {
    const { text, rating } = req.body || {};
    const { cid, uid } = req.channel || {};

    if (!cid || !uid) {
      return res.status(401).json({ error: "Channel auth missing" });
    }

    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return res.status(400).json({ error: "text required" });
    }

    let cleanRating;
    try {
      cleanRating = parseRatingOrThrow(rating);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    await publishToQueue({
      type: "APPEAL_ANALYZE",
      data: {
        userId: Number(uid),
        cid: Number(cid),
        text: text.trim(),
        rating: cleanRating,
      },
      createdAt: Date.now(),
    });

    return res.status(202).json({ ok: true, queued: true });
  } catch (e) {
    console.error("❌ EXTERNAL QUEUE ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}