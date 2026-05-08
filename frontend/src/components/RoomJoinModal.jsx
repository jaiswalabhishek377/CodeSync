import { useState } from "react";
import toast from "react-hot-toast";

function RoomJoinModal({ onCreateRoom, onJoinRoom, onClose }) {
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [language, setLanguage] = useState("cpp");

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }
    setIsCreating(true);
    try {
      await onCreateRoom({ name: roomName, language });
      setRoomName("");
    } catch (error) {
      toast.error("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      toast.error("Please enter a room code");
      return;
    }
    try {
      await onJoinRoom(roomCode);
      setRoomCode("");
    } catch (error) {
      toast.error("Failed to join room");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-6">SyncSpace</h2>

        {/* Create Room */}
        <div className="mb-8 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Create New Room
          </h3>
          <input
            type="text"
            placeholder="Room name (e.g., 'Project X')"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded-lg mb-3 focus:outline-none focus:border-blue-500 shrink-0"
          />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded-lg mb-3 focus:outline-none focus:border-blue-500"
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
          </select>
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Create Room"}
          </button>
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900 text-gray-400 font-mono">OR</span>
          </div>
        </div>

        {/* Join Room */}
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Join Existing Room
          </h3>
          <input
            type="text"
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded-lg mb-3 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={handleJoinRoom}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition mb-3"
          >
            Join Room
          </button>
          <button
            onClick={onClose}
            className="w-full bg-transparent hover:bg-gray-800 text-gray-400 font-semibold py-2 rounded-lg transition border border-gray-700 mt-2"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoomJoinModal;
