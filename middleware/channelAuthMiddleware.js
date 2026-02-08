// import { pool } from "../db.js";

// /**
//  * Внешняя интеграция:
//  * - Body: { cid, text }
//  * - Header: X-Channel-Key: <api_key>
//  *
//  * Проверяет, что cid существует и ключ совпадает,
//  * и кладёт найденные cid/uid в req.channel
//  */
// export async function channelKeyRequired(req, res, next) {
//   try {
//     const { cid } = req.body || {};
//     const apiKey = req.header("X-Channel-Key") || req.body?.api_key;

//     if (!cid || !Number.isInteger(Number(cid))) {
//       return res.status(400).json({ error: "cid is required (number)" });
//     }

//     if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
//       return res.status(401).json({ error: "Missing channel api key (X-Channel-Key)" });
//     }

//     const r = await pool.query(
//       `SELECT id, uid FROM clair_channels WHERE id=$1 AND api_key=$2`,
//       [Number(cid), apiKey]
//     );

//     if (r.rowCount === 0) {
//       return res.status(403).json({ error: "Invalid cid or api key" });
//     }

//     req.channel = { cid: r.rows[0].id, uid: r.rows[0].uid };
//     next();
//   } catch (e) {
//     console.error("channelKeyRequired error:", e);
//     return res.status(500).json({ error: "Internal error" });
//   }
// }
import { pool } from "../db.js";

export async function channelKeyRequired(req, res, next) {
  const apiKey = req.headers["x-channel-key"];
  const { cid } = req.body;

  if (!apiKey || !cid) {
    return res.status(401).json({ error: "Missing channel key or cid" });
  }

  const r = await pool.query(
    `SELECT id, uid FROM clair_channels WHERE id=$1 AND api_key=$2`,
    [cid, apiKey]
  );

  if (r.rowCount === 0) {
    return res.status(403).json({ error: "Invalid channel key" });
  }

  req.channel = { cid, uid: r.rows[0].uid };
  next();
}
