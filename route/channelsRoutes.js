import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { createChannel, setChannelApiKey } from "../controller/channels.js";

const router = Router();

router.post("/channels", authRequired, createChannel);
router.put("/channels/:cid/api-key", authRequired, setChannelApiKey);

export default router;
