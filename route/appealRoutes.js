import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { channelKeyRequired } from "../middleware/channelAuthMiddleware.js";
import { analyzeAndCreateAppeal, ingestExternalAppeal } from "../controller/appeals.js";

const router = Router();

// (A) внутренний (админка)
router.post("/appeals/analyze", authRequired, analyzeAndCreateAppeal);

// (B) внешний (интеграции)
router.post("/ingest/appeal", channelKeyRequired, ingestExternalAppeal);

export default router;
