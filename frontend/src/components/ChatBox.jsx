import { useState, useEffect, useRef } from 'react';

function ChatBox({ socket, roomCode, currentUser }) {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`chat_${roomCode}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(`chat_${roomCode}`, JSON.stringify(messages));
  }, [messages, roomCode]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    socket.on('receive-chat', handleMessage);

    return () => {
      socket.off('receive-chat', handleMessage);
    };
  }, [socket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket || !roomCode) return;

    const messageData = {
      roomCode,
      sender: currentUser?.name || 'Anonymous',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    socket.emit('send-chat', messageData);
    setMessages((prev) => [...prev, messageData]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 w-full overflow-hidden">
      <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">Group Chat</h3>
        <button 
          onClick={() => {
            setMessages([]);
            localStorage.removeItem(`chat_${roomCode}`);
          }}
          className="text-[10px] text-gray-500 hover:text-red-400 uppercase font-bold"
        >
          Clear
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 text-xs mt-10 italic">No messages yet. Start the conversation!</p>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.sender === currentUser?.name ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-gray-400">{msg.sender}</span>
              <span className="text-[10px] text-gray-600">{msg.timestamp}</span>
            </div>
            <div className={`px-3 py-2 rounded-2xl max-w-[90%] break-words text-sm ${
              msg.sender === currentUser?.name 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-gray-700 text-gray-200 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-700 text-white text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 transition-all"
        />
        <button 
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default ChatBox;