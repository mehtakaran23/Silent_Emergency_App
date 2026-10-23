import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Landing = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing-hero">
      <div className="landing-hero-grid">
        <section className="landing-copy">
          <div className="eyebrow">Private safety, when it matters</div>
          <h1>A quiet signal for the moments you need <span>help.</span></h1>
          <p>
            Silent SOS gives you a discreet way to alert trusted people,
            share your location, and keep a clear record of what happened.
          </p>
          <div className="landing-actions">
            <Link to={isAuthenticated ? "/" : "/register"} className="btn btn-primary">
              {isAuthenticated ? "Open your dashboard" : "Create your account"}
            </Link>
            {!isAuthenticated && <Link to="/login" className="btn btn-secondary">Sign in</Link>}
          </div>
          <div className="trust-line">
            <span>✓ No loud alarms</span>
            <span>✓ You control your contacts</span>
            <span>✓ Location only during an SOS</span>
          </div>
        </section>
        <aside className="landing-panel" aria-label="Silent SOS overview">
          <div className="panel-label">Safety control center</div>
          <div className="signal-card">
            <div className="signal-icon">SOS</div>
            <div>
              <strong>Ready when you are</strong>
              <p>Hold to activate a discreet alert.</p>
            </div>
          </div>
          <div className="metric-grid">
            <div className="metric"><div className="metric-value">01</div><div className="metric-label">Private signal</div></div>
            <div className="metric"><div className="metric-value">24/7</div><div className="metric-label">Your safety history</div></div>
          </div>
          <p style={{ marginTop: 22, fontSize: 13 }}>Designed to help you communicate clearly without drawing attention.</p>
        </aside>
      </div>
      <div className="landing-features">
        <div className="feature-card"><div className="feature-icon">◎</div><h3>Discreet SOS</h3><p>Use a deliberate hold gesture to avoid accidental activation.</p></div>
        <div className="feature-card"><div className="feature-icon">⌖</div><h3>Live location</h3><p>Share valid GPS coordinates while an alert is active.</p></div>
        <div className="feature-card"><div className="feature-icon">↗</div><h3>Trusted contacts</h3><p>Keep important people organized and informed through secure email alerts.</p></div>
      </div>
    </div>
  );
};

export default Landing;
