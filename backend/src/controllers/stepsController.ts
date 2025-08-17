import { Request, Response } from "express";
import { StepService } from "../services/stepService.js";
import { logger } from "../utils/logger";

export const stepsController = {
  async getStepsByModuleId(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      logger.debug("GET STEPS", { moduleId });

      const steps = await StepService.getStepsByModuleId(moduleId);
      if (!steps) {
        return res.status(404).json({ error: "Steps not found" });
      }

      res.json(steps);
    } catch (err) {
      logger.error("Error in getStepsByModuleId", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async saveSteps(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const { steps } = req.body;
      logger.debug("SAVE STEPS", { moduleId, count: steps?.length });

      await StepService.saveSteps(moduleId, steps);
      res.json({ success: true });
    } catch (err) {
      logger.error("Error in saveSteps", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
