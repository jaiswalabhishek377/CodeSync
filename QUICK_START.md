# CodeSync - Quick Start (Copy & Paste Commands)

## ⚡ Windows PowerShell - Start All Services

Run these commands in **separate PowerShell windows**:

### Terminal 1: Start Piston (Code Sandbox)
```powershell
docker compose -f "c:\Users\ARPIT\CodeSync\backend\piston\docker-compose.yaml" up
```
Wait for:
```
piston_api | Server running at 0.0.0.0:2000
```

---

### Terminal 2: Start Backend
```powershell
cd "c:\Users\ARPIT\CodeSync\backend" ; npm run server
```
Wait for:
```
✅ Database Connected Successfully
Server is running on http://localhost:5000
Yjs websocket server ready on ws://localhost:1234
```

---

### Terminal 3: Start Frontend
```powershell
cd "c:\Users\ARPIT\CodeSync\frontend" ; npm run dev
```
Wait for:
```
➜  Local:   http://localhost:5173/
```

---

## ✅ Now Test It

1. **Open browser:** http://localhost:5173
2. **Register/Login**
3. **Create Workspace** 
4. **Paste C++ code:**
   ```cpp
   #include <iostream>
   using namespace std;
   
   int main() {
       cout << "Hello!" << endl;
       return 0;
   }
   ```
5. **Click "Run Code"** → Should see output in terminal

---

## 🔧 Verify Services Are Running

In a **new PowerShell window**, check:

```powershell
# Check Piston
curl http://localhost:2000/api/v2/languages

# Check Backend
curl http://localhost:5000/api/health

# Check Database (via Backend)
curl http://localhost:5000/api/health | ConvertFrom-Json | Select-Object database, piston
```

---

## ⚠️ If Something Fails

**Docker not running?**
```powershell
docker ps
# If error → Start Docker Desktop (GUI app)
```

**Piston won't start?**
```powershell
docker logs piston_api
docker ps | grep piston
```

**Backend port 5000 in use?**
```powershell
netstat -ano | findstr :5000
taskkill /PID <PID> /F  # Replace <PID> with the number
```

**Frontend not connecting?**
- Check backend health: `curl http://localhost:5000/api/health`
- Check browser console (F12)
- Verify `.env.local` exists in `CodeSync/frontend`

---

## 📝 What Was Fixed

✅ **Code Execution Engine** (`executeWorkspaceCode`)
- Added timeout detection (30s)
- Better error messages (ECONNREFUSED, ENOTFOUND, ETIMEDOUT)
- Proper stdout/stderr handling
- Graceful fallback if Piston is down

✅ **Health Check Endpoint** (`GET /api/health`)
- Shows Database status
- Shows Piston sandbox status
- Easy to monitor

✅ **Dependency Updates**
- `y-websocket` v3.0.0 (both backend & frontend, was v1.5.4 → v3.0.0)
- `dotenv` moved to dependencies (was in devDependencies)
- All packages compatible

✅ **Environment Configuration**
- Frontend `.env.local` with correct URLs
- Backend uses `PISTON_URL` env var (configurable)

---

## 🎯 Next Steps (After Everything Runs)

- Add more language support in `langMap` in `workspaceController.js`
- Add database seeding for starter projects
- Deploy with Docker Compose (production setup)
- Add CI/CD with GitHub Actions
