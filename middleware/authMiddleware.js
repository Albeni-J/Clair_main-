import jwt from "jsonwebtoken";
import { pool } from "../db.js";

export async function authRequired(req, res, next){
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Bearer token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(payload.sub);
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const r = await pool.query(
      "SELECT id, login FROM clair_users WHERE id=$1",
      [userId]
    );
    if (r.rowCount === 0) return res.status(401).json({ error: "User not found" });

    req.user = r.rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized", details: e.message });
  }
}
