import { useState, useEffect, useRef, useContext } from "react";
import toast from "react-hot-toast";
import axios from 'axios';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import CodeEditor from "../components/CodeEditor";
import RoomJoinModal from "../components/RoomJoinModal";
import ChatBox from "../components/ChatBox";
import { useSocket } from "../context/socketContext";
import { AuthContext } from "../context/storecontext";

const starterCode = `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, SyncSpace!" << endl;\n    return 0;\n}\n`;

function WorkspaceEditor() {
  const { socket, connected: socketConnected } = useSocket();
  const { token } = useContext(AuthContext);
  const [code, setCode] = useState(starterCode);
  const [language, setLanguage] = useState("cpp");
  const [roomCode, setRoomCode] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [editorInstance, setEditorInstance] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const [yjsConnected, setYjsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pendingJoinRef = useRef(null);
  const bindingRef = useRef(null);
  const yjsSessionRef = useRef(null);
  const editorKey = roomCode || 'no-room';

  // Combined connection status
  const connected = socketConnected && yjsConnected;
  const [showChat, setShowChat] = useState(true);

  const handleCreateRoom = async (roomData) => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    const initialCode = starterCode;
    try {
      const res = await axios.post(
        `${API_BASE}/api/workspace/create`,
        { name: roomData.name, description: '', language: roomData.language, code: initialCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const workspace = res.data.workspace;
      const user = res.data.user;
      setCurrentUser(user);
      setWorkspaceId(workspace.id);
      setLanguage(workspace.language);
      setCode(initialCode);
      setRoomCode(workspace.roomCode);
      setShowModal(false);
      toast.success(`Room created: ${workspace.roomCode}`);
      // Initial code is now saved during creation; no need for a secondary PUT.
      pendingJoinRef.current = workspace.roomCode;
    } catch (err) {
      console.error('Create room failed', err);
      toast.error('Failed to create room');
    }
  };

  const handleJoinRoom = async (roomCodeInput) => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post(
        `${API_BASE}/api/workspace/join`,
        { roomCode: roomCodeInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const workspace = res.data.workspace;
      const user = res.data.user;
      setCurrentUser(user);
      setWorkspaceId(workspace.id);
      setLanguage(workspace.language);
      if (workspace.code) setCode(workspace.code);
      else setCode(starterCode);
      setRoomCode(workspace.roomCode);
      setShowModal(false);
      toast.success(`Joined room: ${workspace.roomCode}`);
      pendingJoinRef.current = workspace.roomCode;
    } catch (err) {
      console.error('Join room failed', err);
      toast.error(err.response?.data?.message || 'Failed to join room');
    }
  };

  // Yjs backend (server.js `writeState`) handles autosaving cleanly.
  // We no longer need an aggressive client-side REST save loop.

  useEffect(() => {
    if (!roomCode || !token) {
      return undefined;
    }

    console.log(`🔄 Initializing Yjs for room: ${roomCode}`);
    const serverUrl = import.meta.env.VITE_YJS_URL || 'ws://localhost:1234/yjs';
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(serverUrl, roomCode, doc, {
      params: { token },
    });

    provider.on('status', ({ status }) => {
      console.log(`📡 Yjs connection status: ${status}`);
      setYjsConnected(status === 'connected');
    });

    const ytext = doc.getText('monaco');

    yjsSessionRef.current = { doc, provider, ytext };

    provider.on('sync', (synced) => {
      if (synced) {
        console.log(`✅ Yjs synced for room ${roomCode}, Y.Text length: ${ytext.length}`);
        
        // Final fallback: if DB was empty, seed with starterCode
        if (ytext.length === 0) {
          ytext.insert(0, starterCode);
        }

        // Trigger a re-render so our binding can now attach cleanly
        setIsSynced(true);
      }
    });

    // Listen to external changes from other clients (update React state only)
    const handleYTextUpdate = () => {
      // We no longer manually setCode here to avoid React state-fighting.
      // Yjs handles the Monaco editor directly via MonacoBinding.
    };
    ytext.observe(handleYTextUpdate);

    // Use Yjs awareness for presence instead of relying solely on Socket.IO
    const randomColors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#a3e635'];
    const myColor = randomColors[Math.floor(Math.random() * randomColors.length)];
    
    provider.awareness.setLocalStateField('user', {
      name: currentUser ? currentUser.name : 'Unknown Dev',
      color: myColor,
    });

    const handleAwarenessChange = () => {
      const states = Array.from(provider.awareness.getStates().values());
      const activeUsers = states.map((s) => s.user).filter(Boolean);
      console.log('👥 Awareness states changed, active users:', activeUsers);
      setUsers(activeUsers || []);
    };
    provider.awareness.on('change', handleAwarenessChange);

    return () => {
      ytext.unobserve(handleYTextUpdate);
      provider.awareness.off('change', handleAwarenessChange);
      provider.disconnect();
      provider.destroy();
      doc.destroy();
      yjsSessionRef.current = null;
      setIsSynced(false);
      setYjsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, token]);

  // Removed legacy 'no-Yjs' Code synchronizer to prevent Monaco tug-of-war

  useEffect(() => {
    const session = yjsSessionRef.current;
    const editor = editorInstance;
    const model = editor?.getModel?.();

    if (!session || !editor || !model) {
      return undefined;
    }

    if (!isSynced) {
      // Allow provider to sync from backend first to avoid wiping out default text
      return undefined; 
    }

    console.log(`🔗 Creating MonacoBinding for room ${roomCode}`);

    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    // Create the binding to sync Monaco <-> Y.Text
    bindingRef.current = new MonacoBinding(
      session.ytext,
      model,
      new Set([editor]),
      session.provider.awareness
    );

    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [roomCode, editorInstance, isSynced]);

  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = (data) => {
      toast.success('A user joined the room!');
      console.log('User joined:', data);
    };

    const handleUserLeft = (data) => {
      console.log('User left:', data);
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket]);

  useEffect(() => {
    if (!roomCode || socketConnected) return;
    pendingJoinRef.current = roomCode;
  }, [socketConnected, roomCode]);

  useEffect(() => {
    if (!socket || !socketConnected || !roomCode) return;
    if (pendingJoinRef.current !== roomCode) return;

    console.log(`📨 Emitting join-room for ${roomCode}`);
    socket.emit('join-room', roomCode);
    pendingJoinRef.current = null;
  }, [socket, socketConnected, roomCode]);

  const handleRunCode = async () => {
    if (!editorInstance) return;
    
    setIsRunning(true);
    setOutput("⏳ Compiling and running...");
    
    try {
      const currentCode = editorInstance.getValue();
      
      // Map language names to Piston API identifiers (v3 compatible)
      const langMap = {
        'cpp': { language: 'c++', version: '10.2.0' },
        'python': { language: 'python', version: '3.10.0' },
        'javascript': { language: 'javascript', version: '18.15.0' },
        'java': { language: 'java', version: '15.0.2' }
      };

      const selectedConfig = langMap[language] || langMap['cpp'];

      const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
        language: selectedConfig.language,
        version: selectedConfig.version,
        files: [
          {
            content: currentCode,
          },
        ],
      });

      const result = response.data.run;
      
      if (result.stdout || result.stderr) {
        setOutput(result.stdout || result.stderr);
      } else {
        setOutput("Program executed successfully with no output.");
      }
      
      if (result.stderr) {
        toast.error("Execution had errors");
      } else {
        toast.success("Code executed!");
      }

    } catch (error) {
      console.error("Execution error:", error);
      toast.error("Failed to execute code");
      setOutput("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setIsRunning(false);
    }
  };

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast.success("Room code copied!");
    }
  };

  const leaveRoom = () => {
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    // Clear the ghost text and cursors
    if (editorInstance && editorInstance.getModel?.()) {
      editorInstance.getModel().setValue(""); 
    }

    if (yjsSessionRef.current) {
      yjsSessionRef.current.provider.destroy();
      yjsSessionRef.current.doc.destroy();
      yjsSessionRef.current = null;
    }
    if (socket && roomCode) {
      socket.emit('leave-room', roomCode);
    }
    setUsers([]);
    setRoomCode(null);
    setWorkspaceId(null);
    setCode(starterCode);
    pendingJoinRef.current = null;
    setEditorInstance(null);
    setShowModal(true);
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-blue-400">SyncSpace</h1>
          {roomCode && (
            <div className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
              <span className="text-sm text-gray-300">Room:</span>
              <code className="font-mono font-bold">{roomCode}</code>
              <button
                onClick={copyRoomCode}
                className="ml-2 p-1 hover:bg-gray-600 rounded transition"
                title="Copy room code"
              >
                📋
              </button>
            </div>
          )}
          {/* WebSocket Status */}
          <div className={`text-xs px-2 py-1 rounded ${connected ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
            {connected ? '🟢 Connected' : '🔴 Offline'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
          </select>

          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold transition disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run Code"}
          </button>

          <button
            onClick={leaveRoom}
            className="px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition"
          >
            Change Room
          </button>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-gray-700 rounded transition ml-1"
            title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
          >
            {isSidebarOpen ? "➡" : "⬅"}
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Code Editor */}
        <div className="flex-1 overflow-hidden relative">
          <CodeEditor
            key={editorKey}
            code={code}
            language={language}
            onMount={(editor) => {
              setEditorInstance(editor);
            }}
          />
        </div>

        {/* Sidebar and Chat */}
        {isSidebarOpen && (
          <div className="w-[320px] bg-gray-800 border-l border-gray-700 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out">
            {/* Users Section */}
            <div className="p-4 border-b border-gray-700 min-h-[120px] max-h-[200px] overflow-y-auto custom-scrollbar text-[10px]">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Users Online</h3>
              <div className="space-y-2">
                {users.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">You are alone in this room</p>
                ) : (
                  users.map((user, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(0,0,0,0.5)]"
                        style={{ backgroundColor: user.color }}
                      ></div>
                      <span className="text-gray-200 font-medium truncate">{user.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Box Component */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ChatBox 
                socket={socket} 
                roomCode={roomCode} 
                currentUser={currentUser} 
              />
            </div>
          </div>
        )}
      </div>

      {/* Terminal Output */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 h-48 overflow-auto font-mono text-sm">
        <h3 className="text-gray-300 font-semibold mb-2">Terminal</h3>
        <div className="text-gray-400 whitespace-pre-wrap">
          {output || "Output will appear here after running code..."}
        </div>
      </div>

      {/* Room Modal */}
      {showModal && (
        <RoomJoinModal
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default WorkspaceEditor;
