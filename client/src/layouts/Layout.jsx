import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Layout = ({ children }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="layout-container">
      <header className="app-header">
        <nav className="nav-container">
          <Link to="/" className="brand-logo">
            <span>🚨</span> Silent SOS
          </Link>
          
          <ul className="nav-links">
            {isAuthenticated ? (
              <>
                <li>
                  <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                    Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/contacts" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                    Contacts
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                    Profile
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                    History
                  </NavLink>
                </li>
                <li style={{ marginLeft: "10px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", marginRight: "10px" }}>
                    Hi, {user?.name || "User"}
                  </span>
                  <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                    Login
                  </NavLink>
                </li>
                <li>
                  <Link to="/register" className="btn btn-primary btn-sm">
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </header>
      
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
