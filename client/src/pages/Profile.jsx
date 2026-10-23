import React, { useEffect, useState } from "react";
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
    API.get("/profile/me").then((res) => {
      if (res.data?.success && res.data.profile) {
        setName(res.data.profile.name || "");
        setEmail(res.data.profile.email || "");
        setPhone(res.data.profile.phone || "");
      }
    }).catch(() => setError("Unable to load your profile.")).finally(() => setFetchLoading(false));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(""); setSuccess("");
    if (!name || (!email && !phone)) return setError("Name and an email or phone number are required.");
    try {
      setLoading(true);
      const result = await API.put("/profile/me", { name, email, phone });
      if (result.data?.success) { await refreshProfile(); setSuccess("Profile saved."); } else setError(result.data?.message || "Unable to save profile.");
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to save profile."); } finally { setLoading(false); }
  };

  return <div style={{ maxWidth: 620, margin: "0 auto" }}>
    <div className="page-header"><div><div className="eyebrow">Account settings</div><h1>Your profile</h1><p>Keep your details current so your account and safety circle stay reliable.</p></div></div>
    {error && <div className="alert-banner alert-banner-danger" role="alert">{error}</div>}
    {success && <div className="alert-banner alert-banner-success" role="status">{success}</div>}
    {fetchLoading ? <div className="spinner" /> : <div className="card"><form onSubmit={handleSubmit}>
      <div className="form-group"><label className="form-label" htmlFor="profile-name">Full name</label><input id="profile-name" className="form-control" value={name} onChange={(event) => setName(event.target.value)} disabled={loading} required /></div>
      <div className="form-group"><label className="form-label" htmlFor="profile-email">Email address</label><input id="profile-email" type="email" className="form-control" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} /></div>
      <div className="form-group"><label className="form-label" htmlFor="profile-phone">Phone number</label><input id="profile-phone" type="tel" className="form-control" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={loading} /></div>
      <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Saving..." : "Save changes"}</button>
    </form></div>}
  </div>;
};

export default Profile;
