import { Request, Response } from "express";
import { ModuleService } from "../services/moduleService";
import { logger } from "../utils/logger";

export const moduleController = {
  async getModuleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      logger.debug("GET MODULE", { id });

      const moduleData = await ModuleService.getModuleById(id);
      if (!moduleData) {
        return res.status(404).json({ error: "Module not found" });
      }

      res.json(moduleData);
    } catch (err) {
      logger.error("Error in getModuleById", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async listModules(_req: Request, res: Response) {
    try {
      logger.debug("LIST MODULES");
      const modules = await ModuleService.listModules();
      res.json(modules);
    } catch (err) {
      logger.error("Error in listModules", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
