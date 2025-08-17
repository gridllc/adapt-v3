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
  },

  // Add missing methods that routes are calling
  async getSteps(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      logger.debug("GET STEPS", { moduleId });

      const steps = await StepService.getStepsByModuleId(moduleId);
      if (!steps) {
        return res.status(404).json({ error: "Steps not found" });
      }

      res.json(steps);
    } catch (err) {
      logger.error("Error in getSteps", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async createSteps(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const { steps } = req.body;
      logger.debug("CREATE STEPS", { moduleId, count: steps?.length });

      await StepService.saveSteps(moduleId, steps);
      res.json({ success: true });
    } catch (err) {
      logger.error("Error in createSteps", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async updateSteps(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const { steps } = req.body;
      logger.debug("UPDATE STEPS", { moduleId, count: steps?.length });

      await StepService.saveSteps(moduleId, steps);
      res.json({ success: true });
    } catch (err) {
      logger.error("Error in updateSteps", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async rewriteStep(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const { stepId, newText } = req.body;
      logger.debug("REWRITE STEP", { moduleId, stepId });

      // For now, just return success - implement AI rewrite later
      res.json({ success: true, message: "Step rewrite not yet implemented" });
    } catch (err) {
      logger.error("Error in rewriteStep", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
