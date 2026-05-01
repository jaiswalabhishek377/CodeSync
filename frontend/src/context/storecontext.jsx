/* eslint-disable react-refresh/only-export-components */
import { createContext, useState } from "react";

export const AuthContext = createContext(null);

const AuthProvider = (props) =>{
  //backend api url
  const url = "http://localhost:5000";

  // to survive page refreshes, we can store the token in localStorage and retrieve it when the app loads
  const [token, setToken] = useState( localStorage.getItem("token") || "");

  //logout function to clear the token from state and localStorage
  const logout = () =>{
    setToken("");
    localStorage.removeItem("token");
  }

  const contextValue = {
    url,
    token,
    setToken,
    logout
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {props.children}
    </AuthContext.Provider>
  )
}

export default AuthProvider;