import {Routes, Route, Navigate} from "react-router-dom"
import { useContext, } from "react"
import { Toaster } from "react-hot-toast"
import { AuthContext } from "./context/storecontext"
import AuthPage from "./pages/AuthPage"
import WorkSpace from "./pages/WorkSpace"
import WorkspaceEditor from "./pages/WorkspaceEditor"

const App = () => {

  const {token} = useContext(AuthContext);


  return (
    <div className={`min-h-screen`}>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={!token ? <AuthPage /> : <Navigate to="/workspace"  replace/> } />
        <Route path="/workspace" element={token ? <WorkSpace/> : <Navigate to="/" replace/> } />
        {/* Test route to see Monaco editor without auth */}
        <Route path="/test-editor" element={<WorkspaceEditor />} />
      </Routes>
    </div>
  )
}

export default App