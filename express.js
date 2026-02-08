import express from "express";
import "dotenv/config";
import cors from "cors";
import geminiTranslate from "./route/aiGeminiTranslateRoutes.js";
import context from "./route/aiContextGeminiRoutes.js";
import authRoutes from "./route/authRoutes.js";
import appealRoutes from "./route/appealRoutes.js";
import { initRabbit } from "./rabbit.js";
import { pool, checkDb } from "./db.js";
import { publishToQueue } from "./rabbit.js";
import channelRoutes from "./route/channelsRoutes.js";
import userRoutes from "./route/userRoutes.js";


const app = express();
const port = 3000;

await checkDb();
await initRabbit();


app.use(cors({
  origin: true,        // отражает любой Origin обратно (нужно для credentials)
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization","X-Channel-Key"],
}));

app.options("*", cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/context", geminiTranslate);
app.use("/api", context);
app.use("/api", appealRoutes);
app.use("/api", channelRoutes);
app.use("/api", userRoutes);

app.get("/ping", (req, res) => {
  console.log("PING HIT");
  res.json({ ok: true });
});



app.post("/api/rabbit/test", async (req, res) => {
  await publishToQueue({
    type: "TEST",
    body: req.body,
    time: Date.now()
  });
  res.json({ ok: true });
});

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
