import prisma from "../config/db.js";
import axios from "axios";

const WORKSPACE_ROLE = Object.freeze({
  OWNER: "owner",
  EDITOR: "editor",
  VIEWER: "viewer",
});

const getWorkspaceMembership = (workspace, userId) => {
  if (!workspace?.users?.length) return null;
  return workspace.users.find((entry) => entry.userId === userId) || null;
};

const canEditWorkspace = (membership) => {
  return Boolean(
    membership &&
      [WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.EDITOR].includes(membership.role)
  );
};

const canDeleteWorkspace = (workspace, membership, userId) => {
  return membership?.role === WORKSPACE_ROLE.OWNER || workspace.ownerId === userId;
};

// Generate unique room code
const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Create new workspace
export const createWorkspace = async (req, res) => {
  try {
    const { name, description, language, code } = req.body;
    const userId = req.userId; // from auth middleware

    if (!name) {
      return res.status(400).json({ success: false, message: "Room name required" });
    }

    const roomCode = generateRoomCode();

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description: description || "",
        language: language || "cpp",
        code: code || "",
        roomCode,
        ownerId: userId,
      },
    });

    // Add creator as workspace user
    await prisma.workspaceUser.create({
      data: {
        userId,
        workspaceId: workspace.id,
        role: WORKSPACE_ROLE.OWNER,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true }
    });

    res.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        roomCode: workspace.roomCode,
        language: workspace.language,
        code: workspace.code || "",
      },
      user: {
        id: userId,
        name: user.fullName
      }
    });
  } catch (error) {
    console.error("Error creating workspace:", error);
    res.status(500).json({ success: false, message: "Error creating workspace" });
  }
};

// Join workspace by room code
export const joinWorkspace = async (req, res) => {
  try {
    const { roomCode } = req.body;
    const userId = req.userId;

    if (!roomCode) {
      return res.status(400).json({ success: false, message: "Room code required" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { roomCode },
      include: { users: true },
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Check if user already in room
    const exists = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: workspace.id,
        },
      },
    });

    if (!exists) {
      // Logic for viewer/editor assignment:
      // If the URL contains a specific query param or if we want logic here
      // For now, let's default to 'editor' but check for a 'mode' if needed
      await prisma.workspaceUser.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: WORKSPACE_ROLE.EDITOR,
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true }
    });

    res.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        roomCode: workspace.roomCode,
        language: workspace.language,
        code: workspace.code,
      },
      user: {
        id: userId,
        name: user.fullName
      }
    });
  } catch (error) {
    console.error("Error joining workspace:", error);
    res.status(500).json({ success: false, message: "Error joining workspace" });
  }
};

// Get workspace details
export const getWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        users: {
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    // Check if user has access
    const userWorkspace = getWorkspaceMembership(workspace, userId);
    if (!userWorkspace) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    res.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        roomCode: workspace.roomCode,
        language: workspace.language,
        code: workspace.code,
        users: workspace.users.map((u) => ({
          id: u.user.id,
          name: u.user.fullName,
          role: u.role,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching workspace:", error);
    res.status(500).json({ success: false, message: "Error fetching workspace" });
  }
};

// List user's workspaces
export const listWorkspaces = async (req, res) => {
  try {
    const userId = req.userId;

    const workspaces = await prisma.workspaceUser.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            roomCode: true,
            language: true,
            createdAt: true,
          },
        },
      },
    });

    res.json({
      success: true,
      workspaces: workspaces.map((w) => ({
        ...w.workspace,
        role: w.role,
      })),
    });
  } catch (error) {
    console.error("Error listing workspaces:", error);
    res.status(500).json({ success: false, message: "Error listing workspaces" });
  }
};

// Update workspace code
export const updateWorkspaceCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, language } = req.body;
    const userId = req.userId;

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: { users: true },
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    // Check if user has access
    const userAccess = getWorkspaceMembership(workspace, userId);
    if (!canEditWorkspace(userAccess)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const updated = await prisma.workspace.update({
      where: { id },
      data: {
        code: code || workspace.code,
        language: language || workspace.language,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      workspace: {
        id: updated.id,
        code: updated.code,
        language: updated.language,
      },
    });
  } catch (error) {
    console.error("Error updating workspace:", error);
    res.status(500).json({ success: false, message: "Error updating workspace" });
  }
};

// Delete workspace
export const deleteWorkspace = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.userId;

    const workspace = await prisma.workspace.findUnique({
      where: { roomCode },
      include: { 
        users: true,
        owner: true
      }
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    // RBAC: Strict Owner-Only Deletion
    const userAccess = getWorkspaceMembership(workspace, userId);

    if (!canDeleteWorkspace(workspace, userAccess, userId)) {
      return res.status(403).json({ 
        success: false, 
        message: "Permission Denied: Only the workspace owner can delete this project." 
      });
    }

    // Delete workspace (Prisma handles CASCADE for Users and Records based on schema)
    await prisma.workspace.delete({
      where: { id: workspace.id }
    });

    res.json({ success: true, message: "Workspace deleted successfully" });
  } catch (error) {
    console.error("Error deleting workspace:", error);
    res.status(500).json({ success: false, message: "Internal server error during deletion" });
  }
};

// Execute code via local Piston Docker container
// Execute code via local Piston Docker container
export const executeWorkspaceCode = async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({ success: false, message: "Code and language required" });
    }
    
    // FIX 1: Map exact identifiers AND add standard file names
    const langMap = {
      'cpp': { language: 'c++', version: '*', fileName: 'main.cpp' },
      'python': { language: 'python', version: '*', fileName: 'main.py' },
      'javascript': { language: 'javascript', version: '*', fileName: 'main.js' }, // Fix: Changed from 'node' to 'javascript'
      'java': { language: 'java', version: '*', fileName: 'Main.java' }
    };

    const selectedConfig = langMap[language] || langMap['cpp'];
    const PISTON_URL = process.env.PISTON_URL || 'http://localhost:2000';
    const EXECUTION_TIMEOUT = 30000; // 30 seconds

    try {
      // Hit Piston sandbox with timeout
      const response = await axios.post(
        `${PISTON_URL}/api/v2/execute`,
        {
          language: selectedConfig.language,
          version: selectedConfig.version,
          files: [{ 
            name: selectedConfig.fileName, // FIX 2: Explicitly pass the file name to Piston
            content: code 
          }]
        },
        { timeout: EXECUTION_TIMEOUT }
      );
      
      // ADD THIS LINE TO DEBUG:
      console.log("🔍 RAW PISTON RESPONSE:", JSON.stringify(response.data, null, 2));

      // Piston v2 separates compilation (for C++/Java) and execution (for Python/JS)
      const { compile, run } = response.data;

      // Handle compilation errors natively
      if (compile && compile.code !== 0) {
        return res.json({
          success: true,
          output: compile.output || compile.stderr || "Compilation failed",
          exitCode: compile.code,
          hasErrors: true
        });
      }

      // Handle successful execution
      if (run) {
        const output = run.output || run.stdout || run.stderr || "Program executed successfully (no output).";
        return res.json({
          success: true,
          output: output.trim(),
          exitCode: run.code || 0,
          hasErrors: run.code !== 0 || !!run.stderr
        });
      }

      res.json({ success: true, output: "Execution completed.", hasErrors: false });

    } catch (pistonError) {
      if (pistonError.code === 'ECONNREFUSED') {
        return res.status(503).json({ success: false, message: `❌ Sandbox service unavailable. Is Docker running?` });
      }
      if (pistonError.code === 'ETIMEDOUT') {
        return res.status(504).json({ success: false, message: "⏱️ Code execution timed out." });
      }
      
      if (pistonError.response) {
        console.error("❌ Piston API Rejected Request:", pistonError.response.data);
        return res.status(pistonError.response.status).json({
          success: false,
          message: pistonError.response.data.message || "Invalid execution payload."
        });
      }
      
      throw pistonError;
    }

  } catch (error) {
    console.error("❌ Execution error:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Code execution failed. Check backend logs."
    });
  }
};
