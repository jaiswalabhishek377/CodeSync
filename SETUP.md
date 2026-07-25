# CodeSync Setup & Troubleshooting Guide

## 🚀 Quick Start (3 services needed)

### Prerequisites
- **Docker Desktop** installed and running
- **Node.js 18+** installed
- Database: Uses **Supabase PostgreSQL** (configured in `.env`)

---

## Step 1️⃣ Start Piston (Code Sandbox)

Piston is required for `executeWorkspaceCode` to work. Without it, "Run Code" will fail.

### Check Docker Status
```powershell
docker info
```
If Docker is not running, **start Docker Desktop** first.

### Start Piston Container
```powershell
cd "c:\Users\ARPIT\CodeSync\backend\piston"
docker compose up -d
```

### Verify Piston is Running
```powershell
curl http://localhost:2000/api/v2/languages
# Should return a JSON list of supported languages
```

**Troubleshooting Piston:**
- `docker daemon not running` → Start Docker Desktop
- `Connection refused on port 2000` → Check `docker ps` to see if container is actually running
  ```powershell
  docker ps | grep piston
  docker logs piston_api  # view container logs
  ```
- `Image not found` → Pull the Piston image first:
  ```powershell
  docker pull ghcr.io/engineer-man/piston
  docker compose up -d
  ```

---

## Step 2️⃣ Start Backend Server

```powershell
cd "c:\Users\ARPIT\CodeSync\backend"
npm run server
```

**Expected output:**
```
✅ Database Connected Successfully
Server is running on http://localhost:5000
WebSocket server ready for connections
Yjs websocket server ready on ws://localhost:1234
```

**Verify Backend Health:**
```powershell
curl http://localhost:5000/api/health
```

Response should show:
```json
{
  "success": true,
  "database": "ok",
  "piston": "ok",
  "message": "Server healthy. Piston sandbox: ok"
}
```

---

## Step 3️⃣ Start Frontend

In a **new terminal window**:

```powershell
cd "c:\Users\ARPIT\CodeSync\frontend"
npm run dev
```

**Expected output:**
```
VITE v8.0.10  ready in 123 ms

➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 in your browser.

---

## 🧪 Test Code Execution

1. Register/login in UI
2. Create a workspace
3. Paste this C++ code:
   ```cpp
   #include <iostream>
   using namespace std;
   
   int main() {
       cout << "Hello from Piston!" << endl;
       return 0;
   }
   ```
4. Click **"Run Code"**
5. Check terminal output panel (should show "Hello from Piston!")

---

## 🔍 Common Issues & Fixes

### Issue: "Sandbox service unavailable at http://localhost:2000"
**Cause:** Piston container is not running  
**Fix:**
```powershell
docker compose -f "c:\Users\ARPIT\CodeSync\backend\piston\docker-compose.yaml" up -d
docker ps | grep piston
```

### Issue: "Cannot reach Piston" or "Connection refused"
**Cause:** Docker daemon not running  
**Fix:** Start Docker Desktop (GUI) or run:
```powershell
docker daemon  # Windows (if using Docker for Windows)
# OR open Docker Desktop application manually
```

### Issue: WebSocket connection fails (red 🔴 icon in UI)
**Cause:** Backend not running or wrong port  
**Fix:**
- Check backend is running: `npm run server` in `CodeSync/backend`
- Verify port 5000 is free: `netstat -ano | findstr :5000`

### Issue: Yjs sync not working (content not syncing across users)
**Cause:** Yjs websocket on port 1234 not running  
**Fix:** Backend server.js should auto-start it. Check backend logs for:
```
Yjs websocket server ready on ws://localhost:1234
```

### Issue: "Code execution timed out"
**Cause:** Infinite loop or heavy computation  
**Fix:** Check your code for loops. Timeout is 30 seconds.

### Issue: Database connection error
**Cause:** Supabase credentials wrong in `.env`  
**Fix:** Check `.env` has valid `DATABASE_URL` and `DIRECT_URL`

---

## 📋 What Each Service Does

| Service | Port | Purpose |
|---------|------|---------|
| **Backend** | 5000 | Express.js API + Socket.io + Yjs WS (1234 sublisten) |
| **Frontend** | 5173 | React Vite dev server |
| **Piston** | 2000 | Docker sandbox for C++, Python, JS, Java execution |
| **Database** | Remote | Supabase PostgreSQL (hosted) |

---

## 🛠️ Development

### Full Stack One-Liner (if all services auto-start)
```powershell
# Terminal 1: Piston
cd "c:\Users\ARPIT\CodeSync\backend\piston"; docker compose up

# Terminal 2: Backend
cd "c:\Users\ARPIT\CodeSync\backend"; npm run server

# Terminal 3: Frontend  
cd "c:\Users\ARPIT\CodeSync\frontend"; npm run dev
```

### Monitor Logs
- **Backend:** Check console for `🚪 Socket... joined room`, `💾 Auto-saved`, execution errors
- **Frontend:** Open DevTools (F12) → Console for WebSocket/Yjs logs
- **Piston:** `docker logs piston_api -f`

---

## ✅ Completed Fixes (as of 2026-07-19)

- ✅ Enhanced `executeWorkspaceCode` with timeout, better error messages, connection detection
- ✅ Added `/api/health` endpoint to check Piston + DB connectivity  
- ✅ Aligned `y-websocket` backend ↔ frontend (now both v3.0.0)
- ✅ Moved `dotenv` to dependencies (needed at runtime)
- ✅ Improved Piston error messages (ECONNREFUSED, ENOTFOUND, ETIMEDOUT with clear fixes)

---

## 📞 Need Help?

Run health check:
```bash
curl http://localhost:5000/api/health
```

Check Docker containers:
```bash
docker ps --all
```

View backend logs:
- If running in terminal: scroll up in the `npm run server` terminal
- If container: `docker logs backend` (once containerized)

View Piston logs:
```bash
docker logs piston_api
```
