import { Router } from "express";
import { register, login, me } from "../controller/auth.js";
import { authRequired } from "../middleware/authMiddleware.js";


const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authRequired, me);

export default router;
