import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { acknowledgeContactAlert, getContactResponse } from "../services/api";

const ContactResponse = () => {
  const { token } = useParams();
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadResponse = async () => {
      try {
        const result = await getContactResponse(token);
        setResponse(result.data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "This response link is invalid or expired.");
      } finally { setLoading(false); }
    };
    loadResponse();
    const timer = window.setInterval(loadResponse, 10000);
    return () => window.clearInterval(timer);
  }, [token]);

  const acknowledge = async () => {
    setSubmitting(true); setError("");
    try {
      const result = await acknowledgeContactAlert(token);
      setResponse((current) => ({ ...current, ...result.data, acknowledged: true }));
      setMessage("Thank you. The person who triggered this SOS has been notified.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to acknowledge this alert.");
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="auth-container"><div className="card"><div className="spinner" /></div></div>;

  const location = response?.alert?.currentLocation;
  const hasLocation = Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
  const closed = ["RESOLVED", "CANCELLED"].includes(response?.alert?.status);

  return <div className="auth-container">
    <div className="auth-shell"><div className="eyebrow">Secure contact response</div><h1>Someone may need you.</h1><p>Review the alert details below and let them know you are responding.</p></div>
    <div className="card auth-card">
      {error && <div className="alert-banner alert-banner-danger" role="alert">{error}</div>}
      {message && <div className="alert-banner alert-banner-success" role="status">{message}</div>}
      {response && <>
        <div className="status-strip is-active"><span className="status-dot" /><div><strong>{response.user?.name || "A Silent SOS user"} triggered an alert</strong><span>{new Date(response.alert?.triggeredAt).toLocaleString()}</span></div></div>
        <div className="metric-grid"><div className="metric"><div className="metric-value">{response.alert?.status}</div><div className="metric-label">Current status</div></div><div className="metric"><div className="metric-value">{hasLocation ? "Live" : "—"}</div><div className="metric-label">Location signal</div></div></div>
        {hasLocation && <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block" style={{ marginTop: 18 }}>View latest location</a>}
        <button onClick={acknowledge} className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting || response.acknowledged || closed}>{response.acknowledged ? "Alert acknowledged" : submitting ? "Sending response..." : "I am responding"}</button>
        <p style={{ marginTop: 18, fontSize: 12, textAlign: "center" }}>If there is immediate danger, contact local emergency services.</p>
      </>}
    </div>
  </div>;
};

export default ContactResponse;
