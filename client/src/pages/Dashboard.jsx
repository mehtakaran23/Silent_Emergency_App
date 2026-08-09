import React, { useState, useEffect } from "react";
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
        // 1. Fetch active SOS status
        const sosRes = await API.get("/sos/active");
        if (sosRes.data?.success) {
          setActiveSOS(sosRes.data.alert);
        }

        // 2. Fetch contacts to count them
        const contactsRes = await API.get("/contacts");
        if (contactsRes.data?.success) {
          setContactsCount(contactsRes.data.contacts?.length || 0);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Could not retrieve dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="dashboard-container">
      <div style={{ marginBottom: "24px" }}>
        <h1>Safety Dashboard</h1>
        <p>Monitor your alert statuses and manage security contacts.</p>
      </div>

      {error && <div className="alert-banner alert-banner-danger">{error}</div>}

      {loading ? (
        <div className="spinner"></div>
      ) : (
        <div className="dashboard-grid">
          <div>
            {activeSOS ? (
              <div className="card" style={{ borderLeft: "6px solid var(--primary-red)", marginBottom: "24px" }}>
                <h3 style={{ color: "var(--primary-red)", display: "flex", alignItems: "center", gap: "10px" }}>
                  🚨 SOS Alert is ACTIVE
                </h3>
                <p style={{ margin: "10px 0" }}>
                  An emergency alert was triggered on {new Date(activeSOS.triggeredAt || activeSOS.createdAt).toLocaleString()}.
                </p>
                <Link to="/sos" className="btn btn-primary btn-sm">
                  View SOS Details
                </Link>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: "24px", textAlign: "center", padding: "40px 20px" }}>
                <h2>Need Immediate Help?</h2>
                <p style={{ margin: "12px 0 24px 0" }}>
                  Triggering an SOS sends instant email notifications to all your configured emergency contacts.
                </p>
                <Link to="/sos" className="btn btn-primary" style={{ padding: "12px 30px" }}>
                  🚨 Launch SOS Page
                </Link>
              </div>
            )}

            <div className="card">
              <h3>System Overview</h3>
              <p style={{ margin: "10px 0 20px 0" }}>
                Welcome, <strong>{user?.name}</strong>. Your Silent SOS system is active and monitored.
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ padding: "16px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--primary-red)" }}>
                    {contactsCount}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Emergency Contacts
                  </div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-blue)" }}>
                    Active
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Mail Service Status
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: "24px" }}>
              <h3>Quick Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                <Link to="/contacts" className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start" }}>
                  👥 Manage Contacts
                </Link>
                <Link to="/profile" className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start" }}>
                  ⚙️ Update Profile
                </Link>
                <Link to="/history" className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start" }}>
                  🕒 View SOS History
                </Link>
              </div>
            </div>

            <div className="card">
              <h3>Safety Guidelines</h3>
              <ul style={{ listStyle: "none", padding: 0, marginTop: "12px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <li>✔️ Configure at least 3 emergency contacts with valid emails.</li>
                <li>✔️ Ensure your phone number is correct under your Profile settings.</li>
                <li>✔️ Test coordinates and mail receipt when in a safe environment.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
