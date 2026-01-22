import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";

function signAccessToken({ userId, login }) {
  const secret = process.env.JWT_SECRET;
  const ttl = process.env.JWT_ACCESS_TTL || "15m";
  if (!secret) throw new Error("JWT_SECRET is not set");

  // sub = userId (лучше чем username)
  return jwt.sign({ sub: String(userId), login }, secret, { expiresIn: ttl });
}

export async function register(req, res) {
  try {
    let { username, password, full_name, email, tg_push } = req.body || {};

    // поддержим твой старый формат username, но пишем в login
    const login = typeof username === "string" ? username.trim().toLowerCase() : "";

    if (!login || login.length < 3) {
      return res.status(400).json({ error: "username must be at least 3 chars" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 chars" });
    }

    // проверка занятости login/email
    const exists = await pool.query(
      `SELECT 1 FROM clair_users WHERE login=$1 OR ($2::text IS NOT NULL AND email=$2)`,
      [login, email ?? null]
    );
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const r = await pool.query(
      `INSERT INTO clair_users (login, password, full_name, email, tg_push)
       VALUES ($1, $2, $3, $4, COALESCE($5, FALSE))
       RETURNING id, login, full_name, email, tg_push`,
      [login, passwordHash, full_name ?? null, email ?? null, tg_push ?? false]
    );

    return res.status(201).json({ ok: true, user: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    const login = typeof username === "string" ? username.trim().toLowerCase() : "";

    if (!login || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    const r = await pool.query(
      `SELECT id, login, password FROM clair_users WHERE login=$1`,
      [login]
    );
    if (r.rowCount === 0) return res.status(401).json({ error: "Invalid username or password" });

    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid username or password" });

    const accessToken = signAccessToken({ userId: user.id, login: user.login });

    // можешь хранить в cookie, но пока вернём JSON как у тебя
    return res.json({ access_token: accessToken, token_type: "Bearer" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function me(req, res) {
  // req.user кладёт middleware (ниже)
  return res.json({ id: req.user.id, login: req.user.login });
}
