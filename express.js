import express from "express";
import "dotenv/config";

import geminiTranslate from "./route/aiGeminiTranslateRoutes.js";
import context from "./route/aiContextGeminiRoutes.js";
import authRoutes from "./route/authRoutes.js";
import appealRoutes from "./route/appealRoutes.js";

import { pool, checkDb } from "./db.js";

const app = express();
const port = 3000;

await checkDb();

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/context", geminiTranslate);
app.use("/api", context);
app.use("/api", appealRoutes);

app.get("/ping", (req, res) => {
  console.log("PING HIT");
  res.json({ ok: true });
});

app.post("/api/appeals/test", (req, res) => {
  console.log("🔥 TEST APPEALS HIT");
  res.json({ ok: true });
});

console.log("🔥 appealRoutes подключаются");
app.use("/api", appealRoutes);

app.get("/users", async (req, res) => {
  try {
    const r = await pool.query("SELECT id, login, full_name, email, tg_push FROM clair_users ORDER BY id");
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(port, () => {
  console.log(`Server running: http://localhost:${port}`);
});
