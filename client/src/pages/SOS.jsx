import React from "react";
import { Link } from "react-router-dom";

const SOS = () => {
  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1>Emergency SOS Trigger</h1>
        <p>Quietly alert your emergency contacts and stream your live safety coordinates.</p>
      </div>

      <div className="card sos-trigger-card">
        <div className="sos-btn-container">
          <button className="sos-big-btn" onClick={() => alert("SOS Start Integration Pending (Phase 10)")}>
            SOS
          </button>
        </div>

        <h3 style={{ color: "var(--primary-red)", marginTop: "10px" }}>
          SOS Start Integration Pending
        </h3>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "8px", maxWidth: "440px" }}>
          The backend SOS routes and Socket.IO real-time location stream integrations are scheduled for the next phase. Activating the alert from this button is currently in mockup mode.
        </p>
      </div>

      <div style={{ marginTop: "24px" }}>
        <Link to="/dashboard" className="btn btn-secondary">
          ⬅️ Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default SOS;
