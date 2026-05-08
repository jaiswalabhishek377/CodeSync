import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticateUser } from '../services/authService';
import { ThemeToggle } from '../components/themeToggle';

import { AuthContext } from '../context/storecontext'; 
import { Code2, Mail, Lock, Eye, EyeOff, Loader2, User} from 'lucide-react';

const AuthPage = () => {
  const { url, setToken } = useContext(AuthContext);
  const navigate = useNavigate();

  // Relish Logic: State Management
  const [currentState, setCurrentState] = useState("Login");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [data, setData] = useState({
    fullName: "", 
    email: "",
    password: ""
  });

  // Relish Logic: Input Handler
  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((prevData) => ({ ...prevData, [name]: value }));
  };

  // Relish Logic: Form Submission
  const onSubmitHandler = async (event) => {
    event.preventDefault();
    setIsLoading(true);
   try {
      // Clean, abstract API call
      const response = await authenticateUser(url, currentState, data);
      // using axios to post data to backend and get response
      
      if (response.success) {
        setToken(response.token);
        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user));
        navigate('/dashboard'); 
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-base-200 transition-colors duration-300">
      
      {/* Clean Navbar */}
      <nav className="w-full p-4 flex justify-between items-center bg-base-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xl font-bold">CodeSync</span>
        </div>
        <ThemeToggle />
      </nav>

      {/* Your Original Form Container */}
      <div className="flex-1 flex justify-center items-center">
        <div className="w-full max-w-md p-6 sm:p-12 bg-base-100 rounded-2xl shadow-xl transition-colors duration-300">
          <div className="w-full space-y-8">
            
            {/* Logo & Header */}
            <div className="text-center mb-8">
              <div className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Code2 className="w-6 h-6 text-primary z-10" />
                </div>
                <h1 className="text-2xl font-bold mt-2">
                  {currentState === "Login" ? "Welcome Back" : "Create Account"}
                </h1>
                <p className="text-base-content/60">
                  {currentState === "Login" ? "Sign in to your workspace" : "Initialize your CodeSync"}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={onSubmitHandler} className="space-y-6">
              
              {/* Conditional Full Name Field for Registration */}
              {currentState === "Sign Up" && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Full Name</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-base-content/40 z-10" />
                    </div>
                    <input
                      type="text"
                      name="fullName"
                      className="input input-bordered w-full pl-10 focus:outline-none"
                      placeholder="John Doe"
                      value={data.fullName}
                      onChange={onChangeHandler}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Email</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-base-content/40 z-10" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    className="input input-bordered w-full pl-10 focus:outline-none"
                    placeholder="you@example.com"
                    value={data.email}
                    onChange={onChangeHandler}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Password</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-base-content/40 z-10" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="input input-bordered w-full pl-10 focus:outline-none"
                    placeholder="••••••••"
                    value={data.password}
                    onChange={onChangeHandler}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-base-content/40" />
                    ) : (
                      <Eye className="h-5 w-5 text-base-content/40" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  currentState === "Login" ? "Sign in" : "Register"
                )}
              </button>
            </form>

            {/* Toggle Login/Signup State */}
            <div className="text-center">
              {currentState === "Login" ? (
                <p className="text-base-content/60">
                  Don't have an account?{" "}
                  <span 
                    onClick={() => setCurrentState("Sign Up")} 
                    className="link link-primary cursor-pointer font-medium"
                  >
                    Create account
                  </span>
                </p>
              ) : (
                <p className="text-base-content/60">
                  Already have an account?{" "}
                  <span 
                    onClick={() => setCurrentState("Login")} 
                    className="link link-primary cursor-pointer font-medium"
                  >
                    Login here
                  </span>
                </p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;