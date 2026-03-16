import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { getUserChannelsReports } from "../controller/report.js";

const router = Router();

// пользователь → каналы → отзывы
router.get("/channels/reports", authRequired, getUserChannelsReports);

export default router;