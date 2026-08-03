import express from "express";
import {
  createWorkspace,
  joinWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspaceCode,
  deleteWorkspace,
  executeWorkspaceCode,
} from "../controllers/workspaceController.js";

const router = express.Router();

import { requireAuth } from '../middleware/authMiddleware.js';

// Apply auth middleware to all routes
router.use(requireAuth);

// Routes
router.post("/create", createWorkspace);
router.post("/join", joinWorkspace);
router.get("/list", listWorkspaces);
router.get("/:id", getWorkspace);
router.put("/:id/code", updateWorkspaceCode);
router.delete("/:roomCode", deleteWorkspace);
router.post("/:id/execute", executeWorkspaceCode);

export default router;