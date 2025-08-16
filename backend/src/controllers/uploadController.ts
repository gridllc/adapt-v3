import { Request, Response } from "express";
import { storageService } from "../services/storageService";
import { ModuleService } from "../services/moduleService";
import { enqueueVideoProcessing } from "../services/qstashQueue";
import { logger } from "../utils/logger";

export const uploadController = {
  async getSignedUrl(req: Request, res: Response) {
    try {
      const { filename, type } = req.body;
      logger.debug("SIGNED URL REQUEST", { filename, type });

      const key = `videos/${Date.now()}-${filename}`;
      const url = await storageService.getSignedUploadUrl(key, type);

      res.json({ url, key });
    } catch (err) {
      logger.error("Error in getSignedUrl", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async completeUpload(req: Request, res: Response) {
    try {
      const { key } = req.body;
      logger.debug("UPLOAD COMPLETE", { key });

      const module = await ModuleService.createModule({
        videoKey: key,
        status: "PENDING"
      });

      await enqueueVideoProcessing(module.id, key);

      res.json({ success: true, moduleId: module.id });
    } catch (err) {
      logger.error("Error in completeUpload", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
