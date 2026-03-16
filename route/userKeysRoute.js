import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { setGeminiKey } from "../controller/userKeys.js";

const router = Router();

router.patch("/me/gemini-key", authRequired, setGeminiKey);

export default router;
