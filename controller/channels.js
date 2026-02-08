import { pool } from "../db.js";

// создать канал
export async function createChannel(req, res) {
  const uid = req.user.id;
  const { name } = req.body;

  const r = await pool.query(
    `INSERT INTO clair_channels (uid, name)
     VALUES ($1, $2)
     RETURNING id, name`,
    [uid, name ?? null]
  );

  res.status(201).json({ cid: r.rows[0].id });
}

// установить / сменить api_key канала
export async function setChannelApiKey(req, res) {
  const uid = req.user.id;
  const cid = Number(req.params.cid);
  const { api_key } = req.body;

  if (!api_key || api_key.length < 10) {
    return res.status(400).json({ error: "Invalid api_key" });
  }

  // проверка владельца
  const ch = await pool.query(
    `SELECT id FROM clair_channels WHERE id=$1 AND uid=$2`,
    [cid, uid]
  );
  if (ch.rowCount === 0) {
    return res.status(403).json({ error: "Not your channel" });
  }

  // уникальность
  const ex = await pool.query(
    `SELECT 1 FROM clair_channels WHERE api_key=$1`,
    [api_key]
  );
  if (ex.rowCount > 0) {
    return res.status(409).json({ error: "api_key already used" });
  }

  await pool.query(
    `UPDATE clair_channels SET api_key=$1 WHERE id=$2`,
    [api_key, cid]
  );

  res.json({ ok: true });
}
