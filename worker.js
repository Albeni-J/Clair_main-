import { consumeQueue } from "./rabbit.js";
import { analyzeAndCreateAppealJob } from "./controller/appeals.js";

consumeQueue(async (msg) => {
  try {
    if (!msg || msg.type !== "APPEAL_ANALYZE") return;

    const { userId, cid, text, rating } = msg.data || {};

    if (!userId) throw new Error("Invalid job payload: userId");
    if (!cid) throw new Error("Invalid job payload: cid");
    if (!text || String(text).trim().length < 2) {
      throw new Error("Invalid job payload: text");
    }

    console.log("📥 JOB", { userId, cid, rating });

    await analyzeAndCreateAppealJob({
      userId,
      cid,
      text,
      rating,
    });

    console.log("✅ DONE");
  } catch (e) {
    console.error("❌ Worker error:", e.message);
  }
});