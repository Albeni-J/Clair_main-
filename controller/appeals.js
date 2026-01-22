import { pool } from "../db.js";
import { SYSTEM_PROMPT } from "../prompts/appealPrompt.js";
import { geminiGenerateJson } from "../services/geminiClient.js";
import { safeJsonParse } from "../utils/safeJsonParse.js";

export async function analyzeAndCreateAppeal(req, res) {
  try {
    // 🔍 ДИАГНОСТИКА — СЮДА
    console.log("BODY:", req.body);
    console.log("USER:", req.user);

    const userId = req.user?.id;
    const { cid, text } = req.body || {};

    console.log("CID:", cid, "TEXT:", text);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized (no user in request)" });
    }

    if (!cid || !Number.isInteger(Number(cid))) {
      return res.status(400).json({ error: "cid is required (number)" });
    }

    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return res.status(400).json({ error: "text is required" });
    }

    // 🔐 Проверка канала
    const ch = await pool.query(
      `SELECT id FROM clair_channels WHERE id=$1 AND uid=$2`,
      [Number(cid), userId]
    );

    if (ch.rowCount === 0) {
      return res.status(403).json({ error: "Channel not found or not yours" });
    }

    // 🤖 Gemini
    const prompt = `${SYSTEM_PROMPT}\n\nВходной текст:\n${text}`;
    const raw = await geminiGenerateJson({ prompt });
    const data = safeJsonParse(raw);

    const emotionRating = Number(data.emotion_rating);

    const ins = await pool.query(
      `INSERT INTO clair_appeal
        (cid, rating, emotion, type, status, anomaly_type, anomaly_com, ai_com, org_com, text, is_anomaly, ai_solution)
       VALUES
        ($1, NULL, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10)
       RETURNING *`,
      [
        Number(cid),
        Number.isFinite(emotionRating) ? emotionRating : null,
        data.appeal_type ?? null,
        data.status ?? "new",
        data.anomaly_type ?? null,
        data.anomaly_comment ?? null,
        data.ai_comment ?? null,
        data.text ?? text,
        Boolean(data.is_anomaly),
        data.ai_solution ?? null,
      ]
    );

    return res.status(201).json({
      ok: true,
      appeal: ins.rows[0],
      ai: data,
    });

  } catch (e) {
    console.error("❌ APPEAL ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}
