import { pool } from "../db.js";

// создать канал
export async function createChannel(req, res) {
  const uid = req.user.id;
  const name = String(req.body?.name || "").trim();

  if (!name) {
    return res.status(400).json({ error: "Channel name required" });
  }

  const r = await pool.query(
    `INSERT INTO clair_channels (uid, name)
     VALUES ($1, $2)
     RETURNING id, name`,
    [uid, name]
  );

  res.status(201).json({ cid: r.rows[0].id, name: r.rows[0].name });
}

// установить / сменить api_key канала
export async function setChannelApiKey(req, res) {
  const uid = req.user.id;
  const cid = Number(req.params.cid);
  const key = String(req.body?.api_key || "").trim();

  if (!Number.isFinite(cid)) {
    return res.status(400).json({ error: "Invalid cid" });
  }

  if (key.length < 10) {
    return res.status(400).json({ error: "Invalid api_key" });
  }

  try {
    // одним запросом: и owner-check, и update
    const upd = await pool.query(
      `UPDATE clair_channels
       SET api_key=$1
       WHERE id=$2 AND uid=$3
       RETURNING id`,
      [key, cid, uid]
    );

    if (upd.rowCount === 0) {
      return res.status(403).json({ error: "Not your channel" });
    }

    res.json({ ok: true });
  } catch (e) {
    // если в БД стоит UNIQUE на api_key
    if (e.code === "23505") {
      return res.status(409).json({ error: "api_key already used" });
    }
    return res.status(500).json({ error: e.message });
  }
}