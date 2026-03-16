import { pool } from "../db.js";
import { encryptSecret } from "../utils/cryptoKey.js";

export async function setGeminiKey(req, res) {
  try {
    const userId = req.user?.id;
    const { gemini_api_key } = req.body || {};

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const plain = String(gemini_api_key || "").trim();
    if (plain.length < 10) {
      return res.status(400).json({ error: "gemini_api_key is required" });
    }

    const enc = encryptSecret(plain);     // <- если тут падает, увидишь details
    const last4 = plain.slice(-4);

    await pool.query(
      `UPDATE clair_users
       SET gemini_api_key_enc=$1, gemini_api_key_last4=$2
       WHERE id=$3`,
      [enc, last4, userId]
    );

    return res.json({ ok: true, last4 });
  } catch (e) {
    console.log("setGeminiKey error:", e);
    return res.status(500).json({ error: "Internal error", details: e.message });
  }
}
