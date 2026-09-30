import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

const Profile = () => {
  const { refreshProfile } = useAuth();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setFetchLoading(true);
        const res = await API.get("/profile/me");
        if (res.data?.success && res.data?.profile) {
          const profileData = res.data.profile;
          setName(profileData.name || "");
          setEmail(profileData.email || "");
          setPhone(profileData.phone || "");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError("Unable to load profile data.");
      } finally {
        setFetchLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name || (!email && !phone)) {
      setError("Name and an email or phone number are required.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.put("/profile/me", { name, email, phone });
      if (res.data?.success) {
        setSuccess("Profile updated successfully!");
        // Update user state in AuthContext
        await refreshProfile();
      } else {
        setError(res.data?.message || "Failed to update profile.");
      }
    } catch (err) {
      console.error("Profile update error:", err);
      setError(err.response?.data?.message || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "560px", margin: "40px auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1>My Profile</h1>
        <p>Manage your account credentials and primary phone contact information.</p>
      </div>

      {error && <div className="alert-banner alert-banner-danger">{error}</div>}
      {success && <div className="alert-banner alert-banner-success">{success}</div>}

      {fetchLoading ? (
        <div className="spinner"></div>
      ) : (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone Number</label>
              <input
                type="tel"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }} disabled={loading}>
              {loading ? "Saving Changes..." : "Save Profile Details"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;
