import React, { createContext, useState, useEffect, useContext } from "react";
import API from "../services/api";
import { disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("sos_token"));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Function to initialize session on app load
  useEffect(() => {
    const initializeSession = async () => {
      const savedToken = localStorage.getItem("sos_token");
      if (savedToken) {
        try {
          // Fetch current profile to validate token
          const response = await API.get("/profile/me");
          if (response.data?.success && response.data?.profile) {
            setUser(response.data.profile);
            localStorage.setItem("sos_user", JSON.stringify(response.data.profile));
            setToken(savedToken);
            setIsAuthenticated(true);
          } else {
            // Failed structure check
            handleSessionClear();
          }
        } catch (error) {
          console.error("Failed to restore session:", error);
          handleSessionClear();
        }
      } else {
        handleSessionClear();
      }
      setLoading(false);
    };

    initializeSession();
  }, []);

  const handleSessionClear = () => {
    disconnectSocket();
    localStorage.removeItem("sos_token");
    localStorage.removeItem("sos_user");
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  // Login handler
  const login = async (identifier, password) => {
    setLoading(true);
    try {
      const response = await API.post("/auth/login", { identifier, password });
      if (response.data?.success && response.data?.token) {
        const receivedToken = response.data.token;
        localStorage.setItem("sos_token", receivedToken);
        localStorage.setItem("sos_user", JSON.stringify(response.data.user || {}));
        setToken(receivedToken);
        
        // Fetch full profile details
        const profileRes = await API.get("/profile/me");
        if (profileRes.data?.success && profileRes.data?.profile) {
          setUser(profileRes.data.profile);
          setIsAuthenticated(true);
          return { success: true };
        }
      }
      return { success: false, message: response.data?.message || "Invalid credentials." };
    } catch (error) {
      console.error("Login request error:", error);
      const errorMsg = error.response?.data?.message || "Login failed. Please check your credentials.";
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Register handler
  const register = async (name, email, password, phone) => {
    setLoading(true);
    try {
      const response = await API.post("/auth/register", {
        name,
        email,
        password,
        phone,
      });

      if (response.data?.success) {
        // Register successful, auto-login using credentials
        return await login(email || phone, password);
      }
      return { success: false, message: response.data?.message || "Registration failed." };
    } catch (error) {
      console.error("Registration request error:", error);
      const errorMsg = error.response?.data?.message || "Registration failed. Try again.";
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const logout = () => {
    handleSessionClear();
  };

  // Refresh profile details (useful when user updates their profile)
  const refreshProfile = async () => {
    try {
      const response = await API.get("/profile/me");
      if (response.data?.success && response.data?.profile) {
        setUser(response.data.profile);
      }
    } catch (error) {
      console.error("Could not refresh user profile data:", error);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
