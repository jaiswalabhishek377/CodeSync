import dotenv from 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { WebSocketServer } from 'ws';
import { verifyToken } from './middleware/authMiddleware.js';
import prisma from './config/db.js';
import { connectDB } from './config/db.js';
import yWebsocketUtils from 'y-websocket/bin/utils';
import axios from 'axios';

//import Routers
import authRouter from './routes/authRoute.js';
import workspaceRouter from './routes/workspaceRoutes.js';



//app config
const app = express();
const PORT = process.env.PORT || 5000;
const YJS_PORT = process.env.YJS_PORT || 1234;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});
const yjsWss = new WebSocketServer({ noServer: true });
const yjsHttpServer = createServer();

connectDB();

const { setupWSConnection, getYDoc, setPersistence } = yWebsocketUtils;

setPersistence({
  // When a doc is bound, seed it from DB if present
  bindState: async (roomCode, doc) => {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { roomCode },
        select: { code: true },
      });
      console.log(`🔍 Checking DB for room ${roomCode}. Code found: ${!!workspace?.code}`);

      if (workspace && workspace.code) {
        const ytext = doc.getText('monaco');
        const currentText = ytext.toString();
        
        // Define the starter code to check against securely
        const starterCode = "#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << \"Hello, SyncSpace!\" << endl;\n    return 0;\n}\n";

        if (ytext.length === 0) {
          ytext.insert(0, workspace.code);
          console.log(`🌱 bindState Success: Seeded room ${roomCode} from DB`);
        } else if (currentText === starterCode) {
           // If it only has the starter code, overwrite it with the DB version
           ytext.delete(0, ytext.length);
           ytext.insert(0, workspace.code);
           console.log(`🌱 bindState: Overwrote starter code with DB version for ${roomCode}`);
        }
      }

      // Re-attach auto-save listener because writeState only fires on document destruction
      if (!doc.__autoSaveAttached) {
        let timeoutId;
        doc.on('update', () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(async () => {
            const content = doc.getText('monaco').toString();
            try {
              if (content.length > 0) {
                await prisma.workspace.updateMany({
                  where: { roomCode },
                  data: { code: content, updatedAt: new Date() },
                });
                console.log(`💾 Auto-saved room ${roomCode} (${content.length} chars)`);
              }
            } catch (err) {
              console.error(`❌ Background save failed for ${roomCode}`, err);
            }
          }, 2000); // Save after 2 seconds of inactivity
        });
        doc.__autoSaveAttached = true;
      }

      // Return the doc to tell y-websocket we've handled it
      return doc;
    } catch (err) {
      console.error(`❌ bindState failed for ${roomCode}:`, err);
    }
  },
  writeState: async (roomCode, doc) => {
    try {
      const content = doc.getText('monaco').toString();
      console.log(`💾 Persisting Yjs doc for room ${roomCode} (${content.length} chars)`);
      if (content.length > 0) {
        await prisma.workspace.updateMany({
          where: { roomCode },
          data: {
            code: content,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ Successfully persisted room ${roomCode}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ Failed to persist Yjs state for room ${roomCode}:`, error);
    }
  },
});

// Track per-room presence by userId so the sidebar can show who is online.
const roomPresence = new Map();

const buildRoomUsers = (roomCode) => {
  const room = roomPresence.get(roomCode);
  if (!room) return [];

  const users = Array.from(room.values()).map((entry) => ({
    id: entry.userId,
    name: entry.name,
    color: entry.color,
  }));
  console.log(`📋 Room ${roomCode} has ${users.length} users:`, users.map(u => u.name).join(', '));
  return users;
};

const emitRoomUsers = (roomCode) => {
  const users = buildRoomUsers(roomCode);
  io.to(roomCode).emit('room-users', users);
  console.log(`📡 Emitted room-users for ${roomCode}`);
};

//middleware
app.use(express.json()); // Parse JSON bodies from incoming requests
app.use(cors());   // acess backend from frontend


//api endpoints on the basis of routes
app.use("/api/auth", authRouter); // to access auth routes from frontend
app.use("/api/workspace", workspaceRouter); // workspace routes


//Socket.io event handlers (DAY 2)
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error'));
    const payload = verifyToken(token);
    socket.userId = payload.id;
    return next();
  } catch (err) {
    return next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (userId=${socket.userId})`);
  socket.data.joinedRooms = new Set();

  // Join room
  socket.on('join-room', async (roomCode) => {
    socket.join(roomCode);
    console.log(`🚪 Socket ${socket.id} joined room: ${roomCode}`);

    socket.data.joinedRooms.add(roomCode);

    try {
      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { id: true, fullName: true },
      });

      if (user) {
        console.log(`👤 User ${user.fullName} (${user.id}) joined room ${roomCode}`);
        
        if (!roomPresence.has(roomCode)) {
          roomPresence.set(roomCode, new Map());
        }

        const room = roomPresence.get(roomCode);
        const existing = room.get(user.id);
        if (existing) {
          console.log(`   → User already in room, adding socket`);
          existing.sockets.add(socket.id);
        } else {
          console.log(`   → New user to this room`);
          room.set(user.id, {
            userId: user.id,
            name: user.fullName,
            color: '#60a5fa',
            sockets: new Set([socket.id]),
          });
        }

        emitRoomUsers(roomCode);
        
        // Notify others in room with the JOINED user's name
        socket.to(roomCode).emit('user-joined', {
          userId: user.id,
          userName: user.fullName
        });
      }
    } catch (err) {
      console.error('Failed to update room presence:', err);
    }
  });

  // Leave room
  socket.on('leave-room', (roomCode) => {
    try {
      socket.leave(roomCode);
      socket.data.joinedRooms.delete(roomCode);

      const room = roomPresence.get(roomCode);
      if (room && socket.userId) {
        const entry = room.get(socket.userId);
        if (entry) {
          const userName = entry.name;
          entry.sockets.delete(socket.id);
          if (entry.sockets.size === 0) {
            room.delete(socket.userId);
            // Notify neighbors ONLY when the last socket for this user leaves
            socket.to(roomCode).emit('user-left', { 
              userId: socket.userId,
              userName: userName 
            });
          }
        }

        if (room.size === 0) {
          roomPresence.delete(roomCode);
        }

        emitRoomUsers(roomCode);
      }
    } catch (err) {
      console.error('Error on leave-room:', err);
    }
  });

  // Code change event
  socket.on('code-change', (data) => {
    const { roomCode, code, language } = data;
    // Broadcast to others in room
    socket.to(roomCode).emit('code-update', {
      code,
      language,
      userId: socket.userId
    });
  });

  // Chat message event
  socket.on('send-chat', (data) => {
    const { roomCode, sender, text, timestamp } = data;
    socket.to(roomCode).emit('receive-chat', { sender, text, timestamp });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    for (const roomCode of socket.data.joinedRooms || []) {
      const room = roomPresence.get(roomCode);
      if (!room) continue;

      for (const [userId, entry] of room.entries()) {
        entry.sockets.delete(socket.id);
        if (entry.sockets.size === 0) {
          room.delete(userId);
        }
      }

      if (room.size === 0) {
        roomPresence.delete(roomCode);
      }

      emitRoomUsers(roomCode);
    }
  });
});

yjsWss.on('connection', (ws, request) => {
  const requestUrl = new URL(request.url, 'http://localhost');
  const roomCode = decodeURIComponent(requestUrl.pathname.replace(/^\/yjs\//, ''));

  void (async () => {
    try {
      console.log(`🔗 Yjs client connecting to room: ${roomCode}`);
      
      // Setup the websocket connection
      setupWSConnection(ws, request, { docName: roomCode });
      
      // When this client closes
      ws.on('close', () => {
        console.log(`👋 Client disconnected from room ${roomCode}`);
      });
    } catch (error) {
      console.error('Yjs websocket connection failed:', error);
      ws.close();
    }
  })();
});

yjsHttpServer.on('upgrade', async (request, socket, head) => {
  const requestUrl = new URL(request.url, 'http://localhost');
  if (!requestUrl.pathname.startsWith('/yjs/')) {
    return;
  }

  try {
    const token = requestUrl.searchParams.get('token');
    const payload = verifyToken(token);
    
    // Attach user payload to the request
    request.user = payload; 

    yjsWss.handleUpgrade(request, socket, head, (ws) => {
      yjsWss.emit('connection', ws, request);
    });
  } catch (error) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

yjsHttpServer.listen(YJS_PORT, () => {
  console.log(`Yjs websocket server ready on ws://localhost:${YJS_PORT}`);
});

//routes
app.get("/", (req,res)=>{
    res.send("Hello World!");
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const pistonUrl = process.env.PISTON_URL || 'http://localhost:2000';
    
    // Quick Piston health check (non-blocking, timeout 2s)
    let pistonHealth = 'unknown';
    try {
      const pistonResponse = await axios.get(`${pistonUrl}/api/v2/languages`, { timeout: 2000 });
      pistonHealth = pistonResponse.status === 200 ? 'ok' : 'down';
    } catch (err) {
      pistonHealth = 'down';
    }

    res.json({
      success: true,
      database: 'ok',
      piston: pistonHealth,
      message: `Server healthy. Piston sandbox: ${pistonHealth}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      database: 'error',
      message: "Database connection failed",
      error: error.message
    });
  }
});



//listen the server
httpServer.listen(PORT, ()=>{
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`WebSocket server ready for connections`);
})