import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const [activeSOS, setActiveSOS] = useState(null);
  const [contactsCount, setContactsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [sosRes, contactsRes] = await Promise.all([API.get("/sos/active"), API.get("/contacts")]);
        if (sosRes.data?.success) setActiveSOS(sosRes.data.alert || null);
        if (contactsRes.data?.success) setContactsCount(contactsRes.data.contacts?.length || 0);
      } catch {
        setError("We could not refresh your safety overview.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div><div className="eyebrow">Your safety workspace</div><h1>Good to see you, {user?.name?.split(" ")[0] || "there"}.</h1><p>Keep your safety circle ready and know exactly what happens when you need help.</p></div>
        <Link to="/sos" className="btn btn-primary">Open SOS</Link>
      </div>
      {error && <div className="alert-banner alert-banner-danger" role="alert">{error}</div>}
      <div className={`status-strip ${activeSOS ? "is-active" : ""}`}>
        <span className="status-dot" />
        <div><strong>{activeSOS ? "SOS alert is active" : "You are in a safe state"}</strong><span>{activeSOS ? "Location sharing and notification attempts are running." : "Your account is ready when you need it."}</span></div>
      </div>
      <div className="dashboard-grid">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title"><h2>{activeSOS ? "Active alert" : "Ready for an emergency"}</h2><span className={activeSOS ? "badge badge-active" : "badge badge-resolved"}>{activeSOS ? "Live" : "Standby"}</span></div>
            {activeSOS ? (
              <><p>This alert began {new Date(activeSOS.triggeredAt || activeSOS.createdAt).toLocaleString()}. Open the SOS console to view location updates, contact acknowledgements, and resolve the alert.</p><Link to="/sos" className="btn btn-secondary" style={{ marginTop: 20 }}>View active alert</Link></>
            ) : (
              <><p>When you hold the SOS control for three seconds, the app creates an alert, starts GPS updates, and attempts notification delivery to your eligible contacts.</p><Link to="/sos" className="btn btn-primary" style={{ marginTop: 20 }}>Go to SOS control</Link></>
            )}
            <div className="metric-grid"><div className="metric"><div className="metric-value">{contactsCount}</div><div className="metric-label">Trusted contacts</div></div><div className="metric"><div className="metric-value">{activeSOS ? "Live" : "Ready"}</div><div className="metric-label">Alert status</div></div></div>
          </div>
          <div className="card"><div className="card-title"><h2>Safety checklist</h2></div><ul className="guideline-list"><li>Add at least two contacts with current email addresses.</li><li>Allow location access so an active alert can share coordinates.</li><li>Review alert history after a test in a safe environment.</li></ul></div>
        </div>
        <aside className="card"><div className="card-title"><h2>Quick actions</h2></div><div className="action-list"><Link to="/contacts" className="btn btn-secondary">Manage contacts <span>→</span></Link><Link to="/profile" className="btn btn-secondary">Update profile <span>→</span></Link><Link to="/history" className="btn btn-secondary">Review history <span>→</span></Link></div><div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-color)" }}><div className="eyebrow">Privacy note</div><p style={{ fontSize: 13 }}>Location tracking starts only while an SOS is active. This app does not contact emergency services.</p></div></aside>
      </div>
    </div>
  );
};

export default Dashboard;
