import prisma from "../config/db.js";

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
        role: "owner",
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
      await prisma.workspaceUser.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: "editor",
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
    const userWorkspace = workspace.users.find((u) => u.userId === userId);
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
    const userAccess = workspace.users.find((u) => u.userId === userId);
    if (!userAccess) {
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
      include: { users: true }
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    // Check if user is the owner
    const userAccess = workspace.users.find(u => u.userId === userId && u.role === "owner");
    if (!userAccess) {
      return res.status(403).json({ success: false, message: "Only owners can delete workspaces" });
    }

    // Delete workspace (Prisma should handle related records if set to CASCADE)
    // If not, we manually delete workspace users
    await prisma.workspaceUser.deleteMany({
      where: { workspaceId: workspace.id }
    });

    await prisma.workspace.delete({
      where: { id: workspace.id }
    });

    res.json({ success: true, message: "Workspace deleted successfully" });
  } catch (error) {
    console.error("Error deleting workspace:", error);
    res.status(500).json({ success: false, message: "Error deleting workspace" });
  }
};
