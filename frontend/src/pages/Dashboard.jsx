import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Layout, Plus, Code, Users, Settings, LogOut, ChevronRight, Search } from 'lucide-react';
import RoomJoinModal from '../components/RoomJoinModal';

const Dashboard = () => {
    const [workspaces, setWorkspaces] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [showModal, setShowModal] = useState(false);
    const navigate = useNavigate();

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/auth');
                    return;
                }

                const res = await axios.get(`${API_BASE}/api/workspace/list`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success) {
                    setWorkspaces(res.data.workspaces);
                }
                
                // Get user name from localStorage or build a small profile fetch if needed
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                setUserName(storedUser.fullName || 'Developer');
            } catch (err) {
                console.error('Dashboard fetch error:', err);
                toast.error('Failed to load workspaces');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [navigate, API_BASE]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Navigate first, then reload to clear any memory/socket leaks completely
        navigate('/auth');
        window.location.reload();
    };

    const onCreateNew = () => {
        setShowModal(true);
    };

    const handleCreateRoom = async ({ name, language }) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE}/api/workspace/create`, 
                { name, language },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setShowModal(false);
                navigate(`/workspace/${res.data.workspace.roomCode}`);
            }
        } catch (err) {
            toast.error('Failed to create workspace');
            throw err;
        }
    };

    const handleJoinRoom = async (code) => {
        setShowModal(false);
        navigate(`/workspace/${code}`);
    };

    const filteredWorkspaces = workspaces.filter(ws => 
        ws.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        ws.roomCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ws.language.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#0d1117] text-gray-300 font-sans">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 bg-[#161b22] border-r border-gray-800 flex flex-col">
                <div className="p-6 border-b border-gray-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Code className="text-white w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">CodeSync</h1>
                </div>

                <nav className="flex-1 p-4 space-y-2 mt-4">
                    <button className="flex items-center gap-3 w-full p-3 bg-blue-600/10 text-blue-400 rounded-xl font-medium">
                        <Layout className="w-5 h-5" />
                        Dashboard
                    </button>
                    {/* Coming Soon Indicators for unimplemented features */}
                    <button className="flex items-center gap-3 w-full p-3 text-gray-600 cursor-not-allowed group relative">
                        <Users className="w-5 h-5" />
                        Teams
                        <span className="absolute right-4 text-[8px] bg-gray-800 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">SOON</span>
                    </button>
                    <button className="flex items-center gap-3 w-full p-3 text-gray-600 cursor-not-allowed group relative">
                        <Settings className="w-5 h-5" />
                        Settings
                        <span className="absolute right-4 text-[8px] bg-gray-800 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">SOON</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-gray-800 mb-2">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full p-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 p-10">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">Welcome back, {userName}</h2>
                        <p className="text-gray-500 mt-1">Manage your collaborative workspaces</p>
                    </div>
                    <button 
                        onClick={onCreateNew}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        New Workspace
                    </button>
                </header>

        <div className="relative mb-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, room code, or language..." 
                className="w-full bg-[#161b22] border border-gray-800 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-white"
            />
        </div>

        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-48 bg-[#161b22] border border-gray-800 rounded-2xl animate-pulse" />
                ))}
            </div>
            ) : filteredWorkspaces.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredWorkspaces.map((ws) => (
                        <div 
                            key={ws.id}
                            onClick={() => navigate(`/workspace/${ws.roomCode}`)}
                            className="group bg-[#161b22] border border-gray-800 hover:border-gray-600 rounded-2xl p-6 transition-all cursor-pointer hover:shadow-2xl hover:shadow-black/50 relative overflow-hidden active:scale-[0.98]"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center border border-gray-700">
                                    <Code className="text-blue-400 w-6 h-6" />
                                </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${
                                    ws.role === 'owner' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                }`}>
                                    {ws.role}
                                </span>
                        {ws.role === 'owner' && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(confirm('Delete this workspace?')) {
                                        const token = localStorage.getItem('token');
                                        axios.delete(`${API_BASE}/api/workspace/${ws.roomCode}`, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        }).then(() => {
                                            toast.success('Workspace deleted');
                                            setWorkspaces(workspaces.filter(w => w.id !== ws.id));
                                        }).catch(() => toast.error('Failed to delete'));
                                    }
                                }}
                                className="p-1.5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                                title="Delete Workspace"
                            >
                                <LogOut className="w-4 h-4 rotate-180" />
                            </button>
                        )}
                    </div>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors uppercase">{ws.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">Room: {ws.roomCode}</p>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded-lg">
                            {ws.language.toUpperCase()}
                        </span>
                        <span>{new Date(ws.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-[#161b22]/30 border-2 border-dashed border-gray-800 rounded-3xl">
                        <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Plus className="text-gray-500 w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white">No workspaces found</h3>
                        <p className="text-gray-500 mt-2 mb-6 max-w-sm mx-auto">Create your first collaborative workspace to start coding with your team.</p>
                        <button 
                            onClick={onCreateNew}
                            className="text-blue-400 font-semibold hover:text-blue-300 flex items-center justify-center gap-2 mx-auto transition-colors"
                        >
                            Create one now <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </main>

            {showModal && (
                <RoomJoinModal 
                    onCreateRoom={handleCreateRoom} 
                    onJoinRoom={handleJoinRoom} 
                    onClose={() => setShowModal(false)} 
                />
            )}
        </div>
    );
};

export default Dashboard;