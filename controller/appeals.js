import { pool } from "../db.js";
import { SYSTEM_PROMPT } from "../prompts/appealPrompt.js";
import { geminiGenerateJson } from "../services/geminiClient.js";
import { safeJsonParse } from "../utils/safeJsonParse.js";
import { publishToQueue } from "../rabbit.js";

/* =========================
   JOB — вызывается воркером
========================= */
export async function analyzeAndCreateAppealJob({ userId, cid, text, aiKey }) {
  // 0) нормализуем
  const uid = Number(userId);
  const channelId = Number(cid);
  const cleanText = typeof text === "string" ? text.trim() : "";
  const cleanKey = typeof aiKey === "string" ? aiKey.trim() : "";

  if (!uid || !channelId || cleanText.length < 2) {
    throw new Error("Invalid job payload (userId/cid/text)");
  }
  if (!cleanKey) {
    throw new Error("Gemini key is empty");
  }

  // 1) 🔐 проверяем что канал принадлежит владельцу
  const ch = await pool.query(
    `SELECT id FROM clair_channels WHERE id=$1 AND uid=$2`,
    [channelId, uid]
  );
  if (ch.rowCount === 0) throw new Error("Channel not found or not yours");

  // 2) 🤖 Gemini
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


  // 3) 🧩 маппинг (поддержка разных ключей на всякий)
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
  (raw ? raw.slice(0, 500) : null); // fallback: первые 500 символов

  const aiSolution = data?.ai_solution ?? data?.solution ?? null;

  const isAnomaly = typeof data?.is_anomaly === "boolean"
    ? data.is_anomaly
    : (data?.is_anomaly ? true : false);

  // jsonb поле

  // 4) 💾 INSERT полностью под твою таблицу
  const ins = await pool.query(
    `INSERT INTO clair_appeal
      (cid, rating, emotion, type, status, anomaly_type, anomaly_com, ai_com, org_com, text, is_anomaly, ai_solution)
     VALUES
      ($1, NULL, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10)
     RETURNING *`,
    [
      channelId,
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
    const { cid, text } = req.body || {};

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!cid || !Number.isInteger(Number(cid))) {
      return res.status(400).json({ error: "cid is required (number)" });
    }
    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return res.status(400).json({ error: "text is required" });
    }

    const u = await pool.query(
      `SELECT gemini_api_key FROM clair_users WHERE id=$1`,
      [Number(userId)]
    );

    const aiKey = (u.rows[0]?.gemini_api_key || "").trim();
    if (!aiKey) return res.status(400).json({ error: "Gemini API key not set" });

    await publishToQueue({
      type: "APPEAL_ANALYZE",
      data: { userId: Number(userId), cid: Number(cid), text: text.trim(), aiKey },
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
    const { text } = req.body || {};
    const { cid, uid } = req.channel || {};

    if (!cid || !uid) return res.status(401).json({ error: "Channel auth missing" });
    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return res.status(400).json({ error: "text required" });
    }

    const u = await pool.query(
      `SELECT gemini_api_key FROM clair_users WHERE id=$1`,
      [Number(uid)]
    );

    const aiKey = (u.rows[0]?.gemini_api_key || "").trim();
    if (!aiKey) return res.status(400).json({ error: "Owner Gemini key not set" });

    await publishToQueue({
      type: "APPEAL_ANALYZE",
      data: { userId: Number(uid), cid: Number(cid), text: text.trim(), aiKey },
      createdAt: Date.now(),
    });

    return res.status(202).json({ ok: true, queued: true });
  } catch (e) {
    console.error("❌ EXTERNAL QUEUE ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}
