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
      } finally {
        setLoading(false);
      }
    };
    loadResponse();
    const refreshTimer = window.setInterval(loadResponse, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [token]);

  const acknowledge = async () => {
    setSubmitting(true);
    setError("");
    try {
      const result = await acknowledgeContactAlert(token);
      setResponse((current) => ({ ...current, ...result.data, acknowledged: true }));
      setMessage("Thank you. The person who triggered this SOS has been notified.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to acknowledge this alert.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="auth-container"><div className="card"><div className="spinner" /></div></div>;
  }

  return (
    <div className="auth-container" style={{ maxWidth: "560px" }}>
      <div className="card">
        <div className="auth-header">
          <h1>Silent SOS Response</h1>
          <p>Secure emergency contact response</p>
        </div>
        {error && <div className="alert-banner alert-banner-danger">{error}</div>}
        {message && <div className="alert-banner alert-banner-success">{message}</div>}
        {response && (
          <>
            <p>
              <strong>{response.user?.name || "A Silent SOS user"}</strong> triggered an SOS alert
              at {new Date(response.alert?.triggeredAt).toLocaleString()}.
            </p>
            <p style={{ marginTop: "12px" }}>
              Current status: <strong>{response.alert?.status}</strong>
            </p>
            {Number.isFinite(response.alert?.currentLocation?.latitude) &&
              Number.isFinite(response.alert?.currentLocation?.longitude) && (
                <a
                  href={`https://www.google.com/maps?q=${response.alert.currentLocation.latitude},${response.alert.currentLocation.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ marginTop: "16px", width: "100%" }}
                >
                  View latest location
                </a>
              )}
            <button
              onClick={acknowledge}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "16px" }}
              disabled={submitting || response.acknowledged || ["RESOLVED", "CANCELLED"].includes(response.alert?.status)}
            >
              {response.acknowledged ? "✓ Alert acknowledged" : submitting ? "Acknowledging..." : "I am responding"}
            </button>
            <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
              If there is immediate danger, contact local emergency services.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ContactResponse;
