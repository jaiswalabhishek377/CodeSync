import { useState, useEffect, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  const { roomCode: paramRoomCode } = useParams();
  const navigate = useNavigate();
  const { socket, connected: socketConnected } = useSocket();
  const { token } = useContext(AuthContext);
  const [userName, setUserName] = useState('Developer');
  const [code, _setCode] = useState(starterCode);
  const [showModal, setShowModal] = useState(false);
  const pendingJoinRef = useRef(null);
  const [language, setLanguage] = useState("cpp");
  const [roomCode, setRoomCode] = useState(paramRoomCode || null);
  const [workspaceId, _setWorkspaceId] = useState(null);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("editor"); 
  const [editorInstance, setEditorInstance] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const [yjsConnected, setYjsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const bindingRef = useRef(null);
  const yjsSessionRef = useRef(null);
  const editorKey = roomCode || 'no-room';

  // Toggle Chat Visibility
  const [showChat, setShowChat] = useState(true);

  // Try to safely extract identity facts once upon mount or token update
  const getIdentityName = () => {
    let decodedName = null;
    const storedUserStr = localStorage.getItem('user');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    
    if (currentUser?.fullName || currentUser?.name) {
      decodedName = currentUser.fullName || currentUser.name;
    } else if (storedUser?.fullName || storedUser?.name) {
      decodedName = storedUser.fullName || storedUser.name;
    }

    if (!decodedName && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        decodedName = payload.fullName || payload.name;
      } catch (e) {
        console.error("Token parse error", e);
      }
    }
    
    return decodedName || 'Developer';
  };

  const trueName = getIdentityName();
  
  // Keep React state in sync without breaking hooks rules
  useEffect(() => {
    if (trueName !== 'Developer' && userName !== trueName) {
      setUserName(trueName);
    }
  }, [trueName, userName]);

  // Fetch workspace details if roomCode is in URL
  useEffect(() => {
    const fetchWorkspace = async () => {
      if (!paramRoomCode || !token) return;
      
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await axios.get(`${API_BASE}/api/workspace/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const workspace = res.data.workspaces.find(ws => ws.roomCode === paramRoomCode);
        if (workspace) {
          _setWorkspaceId(workspace.id);
          setLanguage(workspace.language);
          setUserRole(workspace.role);
          
          // Get current user info
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          setCurrentUser(storedUser);
          setRoomCode(paramRoomCode);
        } else {
          // Attempt to join if not in list
          const joinRes = await axios.post(`${API_BASE}/api/workspace/join`, 
            { roomCode: paramRoomCode },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (joinRes.data.success) {
            _setWorkspaceId(joinRes.data.workspace.id);
            setLanguage(joinRes.data.workspace.language);
            setCurrentUser(joinRes.data.user);
            setRoomCode(paramRoomCode);
          }
        }
      } catch (err) {
        console.error("Failed to load workspace:", err);
        toast.error("Workspace access denied");
        navigate('/dashboard');
      }
    };

    fetchWorkspace();
  }, [paramRoomCode, token, navigate]);

  // Combined connection status
  const connected = socketConnected && yjsConnected;

  // Yjs backend (server.js `writeState`) handles autosaving cleanly.
  // We no longer need an aggressive client-side REST save loop.

  useEffect(() => {
    if (socket && roomCode && socketConnected) {
      console.log(`🔌 Socket.io: Joining room ${roomCode}`);
      socket.emit('join-room', roomCode);

      // Listener cleanup to handle state changes during room transitions
      socket.removeAllListeners('user-joined');
      socket.removeAllListeners('user-left');

      socket.on('user-joined', ({ userName: joinedUser }) => {
        const displayName = joinedUser || 'A developer';
        toast.success(`${displayName} joined the room`, { icon: '👋' });
      });

      socket.on('user-left', ({ userName: leftUser }) => {
        const displayName = leftUser || 'A developer';
        toast(`${displayName} left the room`, { icon: '🚪' });
      });
    }
  }, [socket, socketConnected, roomCode]);

  useEffect(() => {
    // Only update Yjs identity after currentUser data has successfully loaded or resolved
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
        console.log(`✅ Yjs synced for room ${roomCode}. Current length: ${ytext.length}`);
        
        // CRITICAL BUG FIX: 
        // Previously, we were checking ytext.length === 0 right after sync.
        // However, if the server has code (seeded from DB), the sync event fires
        // but the content might arrive a millisecond later or be handled by 
        // y-websocket's internal document merging. 
        // If we insert starterCode here, it conflicts with the server's seeded code.
        
        // We will now only seed if the document is empty after a short delay
        // to give the server-side bindState time to populate the document.
        setTimeout(() => {
          if (ytext.length === 0) {
            console.log("🌱 Room is genuinely empty. Seeding default starter code.");
            ytext.insert(0, starterCode);
          }
        }, 500);

        // Trigger a re-render so our binding can now attach cleanly
        setIsSynced(true);
      }
    });

    // Handle initial seed from API if Yjs didn't sync anything (e.g. first user in session)
    // We already do this in server.js bindState, but we'll ensure the UI knows.

    // Listen to external changes from other clients (update React state only)
    const handleYTextUpdate = () => {
      // We no longer manually setCode here to avoid React state-fighting.
      // Yjs handles the Monaco editor directly via MonacoBinding.
    };
    ytext.observe(handleYTextUpdate);

    // Use Yjs awareness for presence instead of relying solely on Socket.IO
    const randomColors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#a3e635'];
    const myColor = randomColors[Math.floor(Math.random() * randomColors.length)];
    
    // Crucial: Set the local state BEFORE the provider handles deeper sync
    console.log(`👤 Identifying as: ${trueName} (Role: ${userRole})`);

    provider.awareness.setLocalStateField('user', {
      name: trueName,
      color: myColor,
      role: userRole
    });

    const handleAwarenessChange = () => {
      const states = Array.from(provider.awareness.getStates().entries());
      const activeUsers = states.map(([clientId, s]) => {
        if (!s.user) return null;
        return {
          ...s.user,
          clientId
        };
      }).filter(Boolean);
      
      console.log("👥 Active users updated in UI:", activeUsers);
      setUsers([...activeUsers]);

      // Improved DOM Injection for dynamic colors and names
      setTimeout(() => {
        const cursorHeads = document.querySelectorAll('.yRemoteSelectionHead');
        cursorHeads.forEach((head) => {
          const parent = head.parentElement;
          if (parent) {
            // MonacoBinding sets border-color on the parent .yRemoteSelection
            const color = parent.style.borderColor || 'orange';
            head.style.backgroundColor = color;
            head.style.borderColor = color;
            
            // Extract username from awareness states based on CSS classes if needed
            // But MonacoBinding usually handles the mapping. We just need to ensure the attribute exists.
            if (!head.getAttribute('data-user-name')) {
              // Check if we can find the matching user by color
              // This is a backup if the attribute isn't set by MonacoBinding
              const userMatch = activeUsers.find(u => u.color === color || head.style.borderLeftColor === u.color);
              if (userMatch) {
                head.setAttribute('data-user-name', userMatch.name);
              } else {
                // Fallback to the first other user if only 2 people are there
                const otherUser = activeUsers.find(u => u.name !== trueName);
                if (otherUser) head.setAttribute('data-user-name', otherUser.name);
              }
            }
          }
        });
      }, 0);
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

  // Separate effect to update Yjs awareness when role/name changes
  useEffect(() => {
    if (yjsSessionRef.current?.provider && trueName) {
      yjsSessionRef.current.provider.awareness.setLocalStateField('user', {
        name: trueName,
        color: '#60a5fa', 
        role: userRole
      });
    }
  }, [trueName, userRole]);

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

    // RBAC: If user is only a 'viewer', set editor to read-only
    if (userRole === 'viewer') {
      editor.updateOptions({ readOnly: true });
      // Clear the selection/cursor if the user is a viewer to avoid confusion
      editor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
      toast('View-only mode: You cannot edit', { icon: '👁️', duration: 4000 });
    } else {
      editor.updateOptions({ readOnly: false });
    }

    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [roomCode, editorInstance, isSynced, userRole]);

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

  const handleCreateRoom = async ({ name, language }) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${API_BASE}/api/workspace/create`, 
        { name, language },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setShowModal(false);
        navigate(`/workspace/${res.data.workspace.roomCode}`);
      }
    } catch (err) {
      toast.error("Failed to create workspace");
      console.error(err);
    }
  };

  const handleJoinRoom = async (code) => {
    setShowModal(false);
    navigate(`/workspace/${code}`);
  };

  const copyRoomCode = () => {
    if (roomCode) {
      const shareUrl = `${window.location.origin}/workspace/${roomCode}`;
      navigator.clipboard.writeText(shareUrl);
      toast.success("Shareable room link copied!", { icon: '🔗' });
    }
  };

  const leaveRoom = () => {
    // 1. Destroy Sync Bindings
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    // 2. Clear Local State
    setUsers([]);
    setRoomCode(null);
    _setWorkspaceId(null);
    setEditorInstance(null);
    setIsSynced(false);
    setYjsConnected(false);

    // 3. Clear Monaco Model content to prevent "leakage" into next room
    if (editorInstance && editorInstance.getModel?.()) {
      editorInstance.getModel().setValue(""); 
    }

    // 4. Notify Server (Socket)
    if (socket && roomCode) {
      socket.emit('leave-room', roomCode);
    }

    // 5. Cleanup Yjs Provider strictly
    if (yjsSessionRef.current) {
      const { provider, doc } = yjsSessionRef.current;
      provider.disconnect();
      provider.destroy();
      doc.destroy();
      yjsSessionRef.current = null;
    }

    // 6. Navigate back to Hub
    navigate('/dashboard');
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
                title="Copy share link"
              >
                🔗
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
            disabled={userRole === 'viewer'}
            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
          </select>

          <button
            onClick={handleRunCode}
            disabled={isRunning || userRole === 'viewer'}
            className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={userRole === 'viewer' ? "Viewers cannot execute code" : "Run Code"}
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
                      <span className="text-gray-200 font-medium truncate">
                        {user.name} 
                        {user.role === 'owner' && <span className="ml-1 text-[8px] text-orange-400 border border-orange-400/30 px-1 rounded-sm">OWNER</span>}
                        {user.role === 'viewer' && <span className="ml-1 text-[8px] text-gray-500 border border-gray-700 px-1 rounded-sm">VIEW</span>}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Box Component */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-700/50 border-b border-gray-600">
                <span className="text-xs font-semibold uppercase text-gray-400">Team Chat</span>
                <button 
                  onClick={() => setShowChat(!showChat)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {showChat ? "Hide" : "Show"}
                </button>
              </div>
            {showChat && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <ChatBox 
                    socket={socket} 
                    roomCode={roomCode} 
                    currentUser={{...currentUser, name: trueName}} 
                  />
                </div>
              )}
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

      {showModal && (
        <RoomJoinModal 
          onCreateRoom={handleCreateRoom} 
          onJoinRoom={handleJoinRoom} 
          onClose={() => roomCode ? setShowModal(false) : navigate("/dashboard")} 
        />
      )}
    </div>
  );
}

export default WorkspaceEditor;
