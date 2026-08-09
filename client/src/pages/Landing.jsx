import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Landing = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing-hero">
      <h1 style={{ marginBottom: "16px", fontSize: "40px" }}>Silent SOS Protection</h1>
      <p style={{ fontSize: "16px", marginBottom: "24px" }}>
        Discreet emergency alerts that notify your emergency contacts instantly. Quietly send details, location coordinates, and automated safety emails when you need help most.
      </p>
      
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "40px" }}>
        {isAuthenticated ? (
          <Link to="/dashboard" className="btn btn-primary">
            Go to Dashboard
          </Link>
        ) : (
          <>
            <Link to="/login" className="btn btn-primary">
              Log In
            </Link>
            <Link to="/register" className="btn btn-secondary">
              Create Free Account
            </Link>
          </>
        )}
      </div>

      <div className="landing-features">
        <div className="feature-card">
          <div className="feature-icon">🚨</div>
          <h3>One-Tap SOS</h3>
          <p>Instantly alert contacts when you are in an unsafe scenario.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">✉️</div>
          <h3>Email Alerts</h3>
          <p>Configured contacts receive structured emergency emails with maps and coordinates.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">👥</div>
          <h3>Emergency Contacts</h3>
          <p>Add, edit, prioritize, and manage up to 5 vital emergency contacts.</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
