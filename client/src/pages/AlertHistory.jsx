import React, { useState, useEffect } from "react";
import API from "../services/api";

const AlertHistory = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAlertHistory();
  }, []);

  const fetchAlertHistory = async () => {
    try {
      setLoading(true);
      const res = await API.get("/sos/history");
      if (res.data?.success) {
        setAlerts(res.data.alerts || []);
      }
    } catch (err) {
      console.error("Failed to load alert history:", err);
      setError("Unable to load SOS history log.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "TRIGGERED":
      case "ACTIVE":
      case "ACKNOWLEDGED":
        return "badge badge-active";
      case "RESOLVED":
        return "badge badge-resolved";
      default:
        return "badge badge-pending";
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1>SOS Alert History</h1>
        <p>Review logs of all triggered silent emergency alerts and response times.</p>
      </div>

      {error && <div className="alert-banner alert-banner-danger">{error}</div>}

      {loading ? (
        <div className="spinner"></div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <h3>No alerts on record</h3>
          <p style={{ marginTop: "8px" }}>Any future emergency triggers will be logged here for audit purposes.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: "10px" }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Coordinates</th>
                  <th>Response Time</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alertItem) => {
                  const hasLocation =
                    alertItem.currentLocation &&
                    alertItem.currentLocation.latitude !== null &&
                    alertItem.currentLocation.longitude !== null;
                  
                  const isResolved = alertItem.status === "RESOLVED";
                  
                  return (
                    <tr key={alertItem._id}>
                      <td style={{ fontWeight: 500 }}>
                        {new Date(alertItem.triggeredAt || alertItem.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(alertItem.status)}>
                          {alertItem.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        {hasLocation ? (
                          <a
                            href={`https://www.google.com/maps?q=${alertItem.currentLocation.latitude},${alertItem.currentLocation.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "underline" }}
                          >
                            {alertItem.currentLocation.latitude.toFixed(4)}, {alertItem.currentLocation.longitude.toFixed(4)}
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td style={{ fontSize: "13px" }}>
                        {isResolved && alertItem.responseTime !== null
                          ? `${alertItem.responseTime} seconds`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertHistory;
