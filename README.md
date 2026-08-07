<div align="center">

# ⚡ CodeSync

### *Next-Generation Real-Time Collaborative Code Editor & Sandboxed Execution Platform*

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Yjs](https://img.shields.io/badge/CRDT-Yjs-2C2D72?style=for-the-badge&logo=yjs&logoColor=white)](https://yjs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Piston--Sandbox-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.style=for-the-badge)](LICENSE)

<p align="center">
  <b>Architected for zero-data-loss collaborative editing, sub-millisecond presence synchronization, and secure multi-language code compilation in isolated Docker containers.</b>
</p>

[Key Features](#-key-features) • [System Architecture](#-system-architecture) • [Tech Stack](#%EF%B8%8F-tech-stack) • [RBAC Matrix](#-role-based-access-control-rbac) • [Quick Start](#-quick-start) • [API Reference](#-api-reference)

---

</div>

## 🌟 Overview

**CodeSync** is a high-performance, full-stack collaborative IDE (similar to Google Docs meets Replit). It enables multiple developers to concurrently edit source code with zero conflict overhead, stream remote cursor positions in real-time, communicate via built-in room chat, and run code securely against a multi-language containerized sandboxed execution engine.

> [!NOTE]
> **Why CRDTs over Naive WebSockets?**
> Standard WebSocket string-broadcasting approaches fail under simultaneous edits (causing cursor jumping, race conditions, and overwritten code). CodeSync utilizes **Conflict-Free Replicated Data Types (Yjs CRDTs)** mapped directly to VS Code's **Monaco Editor** kernel (`y-monaco`), guaranteeing eventual consistency and zero data loss.

---

## 🔥 Key Features

* **⚡ Real-Time Collaborative Editing**: Powered by Yjs CRDTs & Monaco Editor. Supports simultaneous typing without lock contention or data loss.
* **👀 Live Presence & Remote Cursors**: Track peer user focus, active typing selections, and custom user colors in real-time.
* **🛡️ Sandboxed Code Execution**: Compile and execute C++, Python, JavaScript, and Java code securely using Docker-isolated containers via the Piston API engine.
* **🔐 Strict Role-Based Access Control (RBAC)**: Fine-grained permissions (Owner, Editor, Viewer) protecting code changes and execution triggers.
* **💬 In-Room Team Chat**: Socket.io event-driven chat system scoped strictly per workspace session.
* **🔄 Dual-Protocol Architecture**: Hybrid networking using **Socket.io** for control/chat signals + native **WebSocket (`y-websocket`)** for binary CRDT update streams.
* **💾 Automatic DB Persistence**: Debounced background persistence engine that automatically flushes dirty Yjs states back to PostgreSQL via Prisma ORM.
* **🌐 Scalability Ready**: Integrated Redis Pub/Sub adapter hook (`@socket.io/redis-adapter`) enabling effortless multi-node horizontal scaling.

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Client ["Client Tier (Browser)"]
        UI["React 19 Frontend"]
        ME["Monaco Editor (VS Code Kernel)"]
        YJS_C["Yjs CRDT Client"]
        SIO_C["Socket.io Client"]
        UI --> ME
        ME <--> YJS_C
        UI <--> SIO_C
    end

    subgraph Gateway ["Network & Protocol Layer"]
        HTTP_R["HTTP REST Requests"]
        WS_CRDT["y-websocket (Port 1234)"]
        WS_SIO["Socket.io WebSocket (Port 5000)"]
    end

    subgraph Backend ["Server Tier (Node.js / Express)"]
        API["Express API Controllers"]
        YJS_S["Yjs WS Server & Persistence Manager"]
        SIO_S["Socket.io Server & Presence Manager"]
        RBAC["RBAC & Auth Middleware (JWT)"]
    end

    subgraph Storage ["Data & Sandbox Tier"]
        DB[(PostgreSQL / Supabase)]
        REDIS[(Redis Pub/Sub Adapter)]
        PISTON["Piston Docker Container (Port 2000)"]
    end

    SIO_C <-->|Events / Chat / Presence| WS_SIO
    YJS_C <-->|Binary CRDT Sync| WS_CRDT
    UI <-->|REST API| HTTP_R

    HTTP_R --> RBAC --> API
    WS_SIO --> SIO_S
    WS_CRDT --> YJS_S

    API <--> DB
    YJS_S -->|Debounced Auto-Save| DB
    SIO_S <--> REDIS
    API -->|Execute Code Payload| PISTON
```

---

## 🛠️ Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + Vite | Fast HMR rendering and UI state management |
| **Code Editor Engine** | `@monaco-editor/react` | Industrial-grade code editing UI (VS Code kernel) |
| **CRDT Engine** | `Yjs` + `y-websocket` + `y-monaco` | Peer-to-peer conflict-free document synchronization |
| **Styling & UI** | Tailwind CSS + Lucide Icons | Responsive modern dark-theme user interface |
| **Backend Runtime** | Node.js + Express 5 | Event-driven REST API and WebSocket host |
| **Real-Time Gateway** | Socket.io v4.8 | Presence tracking, notifications, and room chat |
| **Database & ORM** | PostgreSQL + Prisma ORM 7 | Relational data persistence and schema migrations |
| **Code Execution** | Docker + Piston Engine | Isolated execution sandbox for untrusted user code |
| **Pub/Sub Scaling** | Redis Adapter (`@socket.io/redis-adapter`) | Multi-node Socket.io event broadcasting |

---

## 🔐 Role-Based Access Control (RBAC)

CodeSync features strict workspace-level permissions to control collaborative editing and system resources:

| Feature / Action | 👑 Owner | ✏️ Editor | 👁️ Viewer |
| :--- | :---: | :---: | :---: |
| **View Workspace & Live Code** | ✅ | ✅ | ✅ |
| **Edit Code Real-Time** | ✅ | ✅ | ❌ *(Monaco Read-Only)* |
| **Change Programming Language** | ✅ | ✅ | ❌ |
| **Execute Code (Sandbox)** | ✅ | ✅ | ❌ *(403 Blocked)* |
| **Send Room Chat Messages** | ✅ | ✅ | ✅ |
| **Invite Editors / Viewers** | ✅ | ✅ | ✅ |
| **Delete Workspace** | ✅ | ❌ | ❌ |

---

## 🚀 Quick Start

### 📋 Prerequisites

Ensure you have the following installed on your machine:
* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher
* **Docker Desktop**: Running locally (required for Piston sandbox)
* **PostgreSQL Database**: Local Postgres instance or host like Supabase

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/jaiswalabhishek377/CodeSync.git
cd CodeSync
```

---

### 2️⃣ Environment Configuration

Create `.env` files for both backend and frontend.

#### **Backend (`backend/.env`)**
```env
PORT=5000
YJS_PORT=1234
JWT_SECRET=your_super_secret_jwt_key_here
DATABASE_URL="postgresql://user:password@localhost:5432/codesync?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/codesync?schema=public"
PISTON_URL="http://localhost:2000"
# Optional Redis setup for multi-node scaling:
# REDIS_URL="redis://localhost:6379"
```

#### **Frontend (`frontend/.env.local`)**
```env
VITE_API_URL=http://localhost:5000
VITE_YJS_URL=ws://localhost:1234/yjs
```

---

### 3️⃣ Installation & Database Setup

```bash
# Setup Backend
cd backend
npm install
npx prisma db push

# Setup Frontend
cd ../frontend
npm install
```

---

### 4️⃣ Launch Services

Open **three terminal windows** to run the services:

#### 🔹 Terminal 1: Start Piston Sandbox Container
```bash
cd backend/piston
docker compose up -d
```
*Verify Piston health:* `curl http://localhost:2000/api/v2/languages`

#### 🔹 Terminal 2: Start Backend Server
```bash
cd backend
npm run dev
```
*Expected Output:*
```
✅ Database Connected Successfully
Server is running on http://localhost:5000
WebSocket server ready for connections
Yjs websocket server ready on ws://localhost:1234
```

#### 🔹 Terminal 3: Start Frontend Dev Server
```bash
cd frontend
npm run dev
```
*Access the app at:* `http://localhost:5173`

---

## 🔌 Service Port Registry

| Service | Protocol | Port | Description |
| :--- | :--- | :--- | :--- |
| **Frontend App** | HTTP | `5173` | Vite React Web Dashboard & Workspace Editor |
| **Backend REST API** | HTTP | `5000` | Express Authentication, Workspaces & Execution Routes |
| **Socket.io Server** | WS / HTTP | `5000` | Real-time presence, user join/leave, team chat |
| **Yjs CRDT Server** | WebSocket | `1234` | High-speed binary Yjs state vector synchronization |
| **Piston Engine** | HTTP | `2000` | Docker sandbox container executing C++, Python, JS, Java |

---

## 📡 API Reference

### 🔐 Auth Routes (`/api/auth`)
* `POST /api/auth/register` - Create user account (returns JWT token)
* `POST /api/auth/login` - Authenticate user credentials

### 📂 Workspace Routes (`/api/workspace`) *(Requires Auth Token)*
* `POST /api/workspace/create` - Create new workspace room
* `POST /api/workspace/join` - Join workspace room via `roomCode` & requested role
* `GET /api/workspace/list` - Fetch all workspaces associated with authenticated user
* `GET /api/workspace/:id` - Fetch workspace details & member list
* `PUT /api/workspace/:id/code` - Update workspace code state manually
* `DELETE /api/workspace/:roomCode` - Delete workspace *(Owner Only)*
* `POST /api/workspace/:id/execute` - Compile & execute code via Piston Sandbox *(Editor/Owner Only)*

### 🩺 System Health Route
* `GET /api/health` - Check live status of backend, PostgreSQL database, and Piston Docker sandbox

---

## 📁 Repository Structure

```
CodeSync/
├── backend/
│   ├── config/             # DB & Prisma client configuration
│   ├── controllers/        # Express request handling logic (Auth, Workspace, Execution)
│   ├── middleware/         # JWT verify and authorization middleware
│   ├── piston/             # Docker Compose configuration for Piston execution engine
│   ├── prisma/             # Prisma schema, migrations, and PostgreSQL models
│   ├── routes/             # Express API routes
│   └── server.js           # Main application entry point (Express, Socket.io, Yjs Server)
├── frontend/
│   ├── src/
│   │   ├── components/     # CodeEditor (Monaco), ChatBox, JoinModal, ThemeToggle
│   │   ├── context/        # React Context providers for Socket.io & Auth store
│   │   ├── pages/          # AuthPage, Dashboard, WorkspaceEditor
│   │   └── App.jsx         # App router and global providers
│   ├── index.html
│   └── vite.config.js
├── SETUP.md                # Comprehensive deployment setup guide
└── QUICK_START.md           # Quick setup commands cheatsheet
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">
  <sub>Built with ❤️ for real-time collaboration.</sub>
</div>
