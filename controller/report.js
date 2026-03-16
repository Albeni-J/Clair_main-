import { pool } from "../db.js";

export async function getUserChannelsReports(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const q = `
    SELECT
        c.id,
        c.name,
        c.channel_key,
        COALESCE(
            json_agg(
                json_build_object(
                    'id', a.id,
                    'rating', a.rating,
                    'emotion', a.emotion,
                    'type', a.type,
                    'status', a.status,
                    'anomaly_type', a.anomaly_type,
                    'ai_comment', a.ai_com,
                    'org_comment', a.org_com
                )
            ) FILTER (WHERE a.id IS NOT NULL),
            '[]'
        ) AS appeals
    FROM clair_channels c
    LEFT JOIN clair_appeal a
        ON a.cid = c.id
    WHERE c.uid = $1
    GROUP BY c.id
    ORDER BY c.id
    `;

    const r = await pool.query(q, [userId]);

    res.json({
      channels: r.rows
    });

  } catch (e) {
    console.error("REPORT ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
}