import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import {
  initializeSocket,
  joinAlertRoom,
  onLocationUpdate,
  onSOSResolved,
  onContactAcknowledged,
  offLocationUpdate,
  offSOSResolved,
  offContactAcknowledged,
} from "../services/socket";

const SOS = () => {
  const [activeSOS, setActiveSOS] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const pressTimerRef = useRef(null);
  const [pressProgress, setPressProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  
  // GPS tracking state
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const watchPositionRef = useRef(null);
  
  // Live location state
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [isResolvingLoading, setIsResolvingLoading] = useState(false);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [notificationLogs, setNotificationLogs] = useState([]);
  
  const PRESS_DURATION = 3000; // 3 seconds in milliseconds
  const PROGRESS_UPDATE_INTERVAL = 50; // Update progress every 50ms

  // Check if there's an active SOS on component mount
  useEffect(() => {
    const fetchActiveSOS = async () => {
      try {
        const res = await API.get("/sos/active");
        if (res.data?.success && res.data?.alert) {
          setActiveSOS(res.data.alert);
          setAcknowledgements(res.data.alert.contactAcknowledgements || []);
          setLastLocationUpdate(
            Number.isFinite(res.data.alert.currentLocation?.latitude) &&
            Number.isFinite(res.data.alert.currentLocation?.longitude)
              ? res.data.alert.currentLocation
              : null
          );
        }
      } catch (err) {
        console.error("Error fetching active SOS:", err);
      }
    };
    fetchActiveSOS();
  }, []);

  // Start GPS tracking when SOS becomes active
  useEffect(() => {
    if (!activeSOS) {
      // Stop tracking if SOS is no longer active
      if (watchPositionRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionRef.current);
        watchPositionRef.current = null;
      }
      setIsTrackingLocation(false);
      setLocationStatus("");
      return;
    }

    // Start geolocation tracking
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation not supported");
      return;
    }

    setLocationStatus("Acquiring location...");

    const handleLocationSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const timestamp = new Date().toISOString();

      setIsTrackingLocation(true);
      setLocationStatus("Location tracking active");

      // Send location to backend
      const sendLocation = async () => {
        try {
          await API.post("/location/update", {
            alertId: activeSOS._id,
            latitude,
            longitude,
            accuracy,
            timestamp,
          });
        } catch (err) {
          console.error("Failed to send location:", err);
          // Don't stop tracking if a single update fails
        }
      };

      sendLocation();
    };

    const handleLocationError = (error) => {
      setIsTrackingLocation(false);
      switch (error.code) {
        case error.PERMISSION_DENIED:
          setLocationStatus("Location permission denied");
          break;
        case error.POSITION_UNAVAILABLE:
          setLocationStatus("Location unavailable");
          break;
        case error.TIMEOUT:
          setLocationStatus("Location request timed out");
          break;
        default:
          setLocationStatus("Unable to retrieve location");
      }
    };

    // Start watching position with high accuracy
    watchPositionRef.current = navigator.geolocation.watchPosition(
      handleLocationSuccess,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // Cleanup on unmount or when SOS becomes inactive
    return () => {
      if (watchPositionRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionRef.current);
        watchPositionRef.current = null;
      }
    };
  }, [activeSOS]);

  const handleSOSMouseDown = () => {
    if (isLoading || activeSOS) return;

    setError("");
    setSuccess("");
    setIsPressing(true);
    setPressProgress(0);

    let elapsedTime = 0;

    pressTimerRef.current = setInterval(() => {
      elapsedTime += PROGRESS_UPDATE_INTERVAL;
      const progress = Math.min((elapsedTime / PRESS_DURATION) * 100, 100);
      setPressProgress(progress);

      if (elapsedTime >= PRESS_DURATION) {
        clearInterval(pressTimerRef.current);
        triggerSOS();
      }
    }, PROGRESS_UPDATE_INTERVAL);
  };

  const handleSOSMouseUp = () => {
    if (pressTimerRef.current) {
      clearInterval(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setIsPressing(false);
    setPressProgress(0);
  };

  const triggerSOS = async () => {
    try {
      setIsLoading(true);
      setError("");
      setSuccess("");

      const res = await API.post("/sos/start");

      if (res.data?.success && res.data?.alert) {
        setActiveSOS(res.data.alert);
        setLastLocationUpdate(null);
        setSuccess("SOS activated successfully. Notification delivery attempts have started.");
        setPressProgress(0);
      } else {
        setError(res.data?.message || "Failed to activate SOS.");
      }
    } catch (err) {
      console.error("SOS activation error:", err);
      const errorMsg = err.response?.data?.message || "Unable to activate SOS. Please try again.";
      setError(errorMsg);
      setPressProgress(0);
    } finally {
      setIsLoading(false);
      setIsPressing(false);
    }
  };

  const resolveSOS = async () => {
    if (!activeSOS || !activeSOS._id) return;

    try {
      setIsResolvingLoading(true);
      setError("");
      setSuccess("");

      const res = await API.post(`/sos/${activeSOS._id}/resolve`);

      if (res.data?.success) {
        // Clear GPS tracking
        if (watchPositionRef.current !== null) {
          navigator.geolocation.clearWatch(watchPositionRef.current);
          watchPositionRef.current = null;
        }

        setSuccess("SOS alert has been resolved. Tracking stopped.");
        setActiveSOS(null);
        setLastLocationUpdate(null);
        setAcknowledgements([]);
      } else {
        setError(res.data?.message || "Failed to resolve SOS.");
      }
    } catch (err) {
      console.error("SOS resolution error:", err);
      const errorMsg = err.response?.data?.message || "Unable to resolve SOS. Please try again.";
      setError(errorMsg);
    } finally {
      setIsResolvingLoading(false);
    }
  };

  const cancelSOS = async () => {
    if (!activeSOS?._id || !window.confirm("Cancel this SOS alert?")) return;
    try {
      setIsResolvingLoading(true);
      const res = await API.post(`/sos/${activeSOS._id}/cancel`);
      if (res.data?.success) {
        setActiveSOS(null);
        setLastLocationUpdate(null);
        setAcknowledgements([]);
        setNotificationLogs([]);
        setSuccess("SOS alert cancelled. Tracking stopped.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to cancel SOS.");
    } finally {
      setIsResolvingLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSOS?._id) return;
    API.get(`/notifications/alert/${activeSOS._id}`)
      .then((res) => setNotificationLogs(res.data?.notifications || []))
      .catch(() => setNotificationLogs([]));
  }, [activeSOS?._id]);

  // Socket.IO integration for real-time updates
  useEffect(() => {
    if (!activeSOS) return;

    // Initialize socket and join alert room
    const socket = initializeSocket();
    if (socket) {
      joinAlertRoom(activeSOS._id);

      // Listen for location updates
      const handleLocationUpdate = (data) => {
        if (data && String(data.alertId) === String(activeSOS._id)) {
          setLastLocationUpdate(data.location || data.alertLocation || null);
        }
      };

      // Listen for SOS resolution
      const handleSOSResolved = (data) => {
        if (data && String(data.alertId) === String(activeSOS._id)) {
          // Clear active SOS after brief delay to show confirmation
          setTimeout(() => {
            setActiveSOS(null);
            setSuccess("");
            setError("SOS has been resolved and tracking stopped.");
          }, 1000);
        }
      };

      onLocationUpdate(handleLocationUpdate);
      onSOSResolved(handleSOSResolved);
      const handleContactAcknowledged = (data) => {
        if (data && String(data.alertId) === String(activeSOS._id)) {
          setAcknowledgements((current) => {
            if (current.some((item) => String(item.contactId) === String(data.contactId))) return current;
            return [...current, data];
          });
          setSuccess(`${data.contactName || "An emergency contact"} acknowledged the alert.`);
        }
      };
      onContactAcknowledged(handleContactAcknowledged);

      // Cleanup listeners
      return () => {
        offLocationUpdate(handleLocationUpdate);
        offSOSResolved(handleSOSResolved);
        offContactAcknowledged(handleContactAcknowledged);
      };
    }
  }, [activeSOS]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearInterval(pressTimerRef.current);
      }
    };
  }, []);

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1>Emergency SOS Trigger</h1>
        <p>Quietly alert your emergency contacts and stream your live safety coordinates.</p>
      </div>

      {error && <div className="alert-banner alert-banner-danger">{error}</div>}
      {success && <div className="alert-banner alert-banner-success">{success}</div>}

      <div className="card sos-trigger-card">
        {activeSOS ? (
          <div style={{ padding: "24px 0" }}>
            <h2 style={{ color: "var(--primary-red)", fontSize: "32px", fontWeight: 700, marginBottom: "12px" }}>
              🚨 SOS ACTIVE
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
              Alert triggered at {new Date(activeSOS.triggeredAt || activeSOS.createdAt).toLocaleTimeString()}.
            </p>
            
            {/* Alert Information Box */}
            <div style={{ padding: "16px", backgroundColor: "rgba(255, 0, 0, 0.05)", borderRadius: "8px", marginBottom: "20px", border: "1px solid var(--primary-red)" }}>
              <p style={{ fontSize: "14px", marginBottom: "8px" }}>
                <strong>Alert ID:</strong> {activeSOS._id}
              </p>
              <p style={{ fontSize: "14px", marginBottom: "8px" }}>
                <strong>Status:</strong> <span style={{ color: "var(--primary-red)", fontWeight: 600 }}>{activeSOS.status}</span>
              </p>
              <p style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <strong>Location:</strong>
                <span style={{ color: isTrackingLocation ? "var(--accent-blue)" : "var(--text-secondary)" }}>
                  {isTrackingLocation ? "🟢 " : "🔴 "}
                  {locationStatus || "Initializing..."}
                </span>
              </p>
            </div>

            {/* Live Location Display */}
            {lastLocationUpdate && lastLocationUpdate.latitude !== null && lastLocationUpdate.longitude !== null ? (
              <div style={{ padding: "16px", backgroundColor: "rgba(0, 0, 255, 0.05)", borderRadius: "8px", marginBottom: "20px", border: "1px solid rgba(0, 0, 255, 0.3)" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px", color: "var(--accent-blue)" }}>
                  📍 Current Location
                </p>
                <p style={{ fontSize: "13px", marginBottom: "6px" }}>
                  <strong>Latitude:</strong> {lastLocationUpdate.latitude.toFixed(6)}
                </p>
                <p style={{ fontSize: "13px", marginBottom: "6px" }}>
                  <strong>Longitude:</strong> {lastLocationUpdate.longitude.toFixed(6)}
                </p>
                {lastLocationUpdate.accuracy && (
                  <p style={{ fontSize: "13px", marginBottom: "6px" }}>
                    <strong>Accuracy:</strong> ±{lastLocationUpdate.accuracy.toFixed(1)}m
                  </p>
                )}
                {lastLocationUpdate.timestamp && (
                  <p style={{ fontSize: "13px", marginBottom: "0", color: "var(--text-secondary)" }}>
                    <strong>Last Updated:</strong> {new Date(lastLocationUpdate.timestamp).toLocaleTimeString()}
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps?q=${lastLocationUpdate.latitude},${lastLocationUpdate.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "12px", marginTop: "10px", display: "block", textDecoration: "underline", color: "var(--accent-blue)" }}
                >
                  View on Google Maps →
                </a>
              </div>
            ) : null}

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              Emergency contacts are being notified. Location data is being tracked continuously.
            </p>
            {acknowledgements.length > 0 && (
              <p style={{ fontSize: "13px", color: "var(--accent-blue)", marginBottom: "20px" }}>
                ✅ {acknowledgements.length} contact{acknowledgements.length === 1 ? "" : "s"} acknowledged this alert.
              </p>
            )}
            {notificationLogs.length > 0 && (
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Notifications: {notificationLogs.map((item) => `${item.recipient} (${item.status})`).join(", ")}
              </p>
            )}

            {/* Resolve Button */}
            <button
              onClick={resolveSOS}
              disabled={isResolvingLoading}
              style={{
                width: "100%",
                padding: "12px 20px",
                backgroundColor: "var(--primary-red)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: isResolvingLoading ? "not-allowed" : "pointer",
                opacity: isResolvingLoading ? 0.6 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              {isResolvingLoading ? "Resolving..." : "🛑 Resolve SOS Alert"}
            </button>
            <button
              onClick={cancelSOS}
              disabled={isResolvingLoading}
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "10px" }}
            >
              Cancel SOS
            </button>
          </div>
        ) : (
          <>
            <div className="sos-btn-container">
              <div
                style={{
                  position: "relative",
                  width: "200px",
                  height: "200px",
                  margin: "0 auto",
                }}
              >
                {/* Progress ring background */}
                <svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    transform: "rotate(-90deg)",
                  }}
                  viewBox="0 0 200 200"
                >
                  {/* Background circle */}
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="var(--primary-red)"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 90}`}
                    strokeDashoffset={`${2 * Math.PI * 90 * (1 - pressProgress / 100)}`}
                    style={{
                      transition: "stroke-dashoffset 0.05s linear",
                    }}
                  />
                </svg>

                {/* Button */}
                <button
                  className="sos-big-btn"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "160px",
                    height: "160px",
                    borderRadius: "50%",
                    fontSize: "36px",
                    fontWeight: 700,
                    border: "none",
                    cursor: isLoading || activeSOS ? "not-allowed" : "pointer",
                    backgroundColor: "var(--primary-red)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isPressing ? 0.9 : 1,
                    transition: "all 0.2s ease",
                    boxShadow: isPressing
                      ? "0 0 30px rgba(255, 0, 0, 0.6)"
                      : "0 8px 24px rgba(255, 0, 0, 0.3)",
                  }}
                  onMouseDown={handleSOSMouseDown}
                  onMouseUp={handleSOSMouseUp}
                  onMouseLeave={handleSOSMouseUp}
                  onTouchStart={handleSOSMouseDown}
                  onTouchEnd={handleSOSMouseUp}
                  disabled={isLoading || activeSOS}
                >
                  SOS
                </button>
              </div>
            </div>

            <div style={{ marginTop: "24px" }}>
              <h3 style={{ color: "var(--primary-red)", fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                Hold for 3 seconds
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                {pressProgress > 0
                  ? `${Math.round(pressProgress)}% — Keep holding to activate`
                  : "Press and hold the SOS button for 3 seconds to trigger the emergency alert."}
              </p>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: "24px" }}>
        <Link to="/" className="btn btn-secondary">
          ⬅️ Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default SOS;
