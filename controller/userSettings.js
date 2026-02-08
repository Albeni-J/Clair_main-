import { pool } from "../db.js";

export async function setGeminiKey(req, res) {
  const uid = req.user.id;
  const { gemini_api_key } = req.body;

  if (!gemini_api_key || gemini_api_key.length < 20) {
    return res.status(400).json({ error: "Invalid Gemini key" });
  }

  await pool.query(
    `UPDATE clair_users SET gemini_api_key=$1 WHERE id=$2`,
    [gemini_api_key, uid]
  );

  res.json({ ok: true });
}
