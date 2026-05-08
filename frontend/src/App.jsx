import {Routes, Route, Navigate} from "react-router-dom"
import { useContext, } from "react"
import { Toaster } from "react-hot-toast"
import { AuthContext } from "./context/storecontext"
import AuthPage from "./pages/AuthPage"
import Dashboard from "./pages/Dashboard"
import WorkspaceEditor from "./pages/WorkspaceEditor"

const App = () => {

  const {token} = useContext(AuthContext);

  return (
    <div className={`min-h-screen`}>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={!token ? <AuthPage /> : <Navigate to="/dashboard" replace/> } />
        <Route path="/auth" element={!token ? <AuthPage /> : <Navigate to="/dashboard" replace/> } />
        <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/" replace/> } />
        <Route path="/workspace/:roomCode" element={token ? <WorkspaceEditor /> : <Navigate to="/" replace/> } />
        {/* Test route */}
        <Route path="/test-editor" element={<WorkspaceEditor />} />
      </Routes>
    </div>
  )
}

export default App