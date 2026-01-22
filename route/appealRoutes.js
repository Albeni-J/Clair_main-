import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { analyzeAndCreateAppeal } from "../controller/appeals.js";

const router = Router();

router.post("/appeals/analyze", authRequired, analyzeAndCreateAppeal);

export default router;
