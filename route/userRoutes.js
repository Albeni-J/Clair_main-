import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { setGeminiKey } from "../controller/userSettings.js";

const router = Router();
router.post("/user/gemini-key", authRequired, setGeminiKey);
export default router;
