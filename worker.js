import { consumeQueue } from "./rabbit.js";
import { analyzeAndCreateAppealJob } from "./controller/appeals.js";

consumeQueue(async (msg) => {
  if (msg.type !== "APPEAL_ANALYZE") return;

  const { userId, cid, text, aiKey } = msg.data;
  if (!userId) throw new Error("Invalid job payload: userId");
  if (!cid) throw new Error("Invalid job payload: cid");
  if (!text || String(text).trim().length < 2) throw new Error("Invalid job payload: text");
  if (!aiKey || String(aiKey).trim().length < 10) throw new Error("Invalid job payload: aiKey");


  console.log("📥 JOB", { userId, cid });

  await analyzeAndCreateAppealJob({ userId, cid, text, aiKey });

  console.log("✅ DONE");
});
