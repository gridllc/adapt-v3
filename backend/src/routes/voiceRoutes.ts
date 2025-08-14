import { Router } from "express";
import multer from "multer";
import { ttsHandler, sttHandler, voiceHealth } from "../controllers/voiceController.js";

const router = Router();

// Small, safe upload limits (v2.x compatible)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB max audio
  fileFilter: (_req, file, cb) => {
    // Accept common audio containers
    const ok = /audio\/(wav|x-wav|mpeg|mp3|ogg|webm|webm;codecs=opus)/i.test(file.mimetype);
    cb(ok ? null : new Error("Unsupported audio type"), ok);
  },
});

router.get("/health", voiceHealth);
router.post("/tts", ttsHandler);                     // { text, voice?, lang? } -> { audioBase64, mime }
router.post("/stt", upload.single("audio"), sttHandler); // form-data: audio(file) + lang? -> { transcript }

export default router;
