import React, { useEffect, useState } from "react";
import API from "../services/api";

const AlertHistory = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/sos/history").then((res) => {
      if (res.data?.success) setAlerts(res.data.alerts || []);
    }).catch(() => setError("Unable to load your SOS history.")).finally(() => setLoading(false));
  }, []);

  const statusClass = (status) => ["TRIGGERED", "ACTIVE", "ACKNOWLEDGED"].includes(status) ? "badge badge-active" : status === "RESOLVED" ? "badge badge-resolved" : "badge badge-pending";

  return <div>
    <div className="page-header"><div><div className="eyebrow">Accountability and context</div><h1>Alert history</h1><p>Review the alerts created from your account and the location context captured at the time.</p></div></div>
    {error && <div className="alert-banner alert-banner-danger" role="alert">{error}</div>}
    {loading ? <div className="spinner" /> : alerts.length === 0 ? <div className="empty-state"><h3>No alerts yet</h3><p>Your completed SOS alerts will appear here.</p></div> : <div className="card" style={{ padding: 10 }}><div className="data-table-container"><table className="data-table"><thead><tr><th>Date</th><th>Status</th><th>Location</th><th>Response time</th></tr></thead><tbody>{alerts.map((alert) => {
      const location = alert.currentLocation;
      const hasLocation = location && location.latitude !== null && location.longitude !== null;
      return <tr key={alert._id}><td>{new Date(alert.triggeredAt || alert.createdAt).toLocaleString()}</td><td><span className={statusClass(alert.status)}>{alert.status}</span></td><td>{hasLocation ? <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</a> : <span className="muted">Not captured</span>}</td><td>{alert.status === "RESOLVED" && alert.responseTime !== null ? `${alert.responseTime}s` : "—"}</td></tr>;
    })}</tbody></table></div></div>}
  </div>;
};

export default AlertHistory;
