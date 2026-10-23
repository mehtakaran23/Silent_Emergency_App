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
        <nav className="nav-container" aria-label="Primary navigation">
          <Link to="/" className="brand-logo">
            <span className="brand-mark">SOS</span>
            <span>Silent SOS</span>
          </Link>
          <ul className="nav-links">
            {isAuthenticated ? (
              <>
                <li><NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Overview</NavLink></li>
                <li><NavLink to="/sos" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>SOS</NavLink></li>
                <li><NavLink to="/contacts" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Contacts</NavLink></li>
                <li><NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>History</NavLink></li>
                <li><NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Profile</NavLink></li>
                <li className="nav-user">
                  <span className="nav-greeting">Hi, {user?.name || "there"}</span>
                  <button onClick={handleLogout} className="btn btn-secondary btn-sm">Sign out</button>
                </li>
              </>
            ) : (
              <>
                <li><NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Sign in</NavLink></li>
                <li><Link to="/register" className="btn btn-primary btn-sm">Create account</Link></li>
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
