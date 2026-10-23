import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (isAuthenticated) navigate("/"); }, [isAuthenticated, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!name || (!email && !phone) || !password) return setError("Name, password, and an email or phone are required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    const result = await register(name, email, password, phone);
    if (result.success) {
      setSuccess("Account created. Preparing your dashboard...");
      window.setTimeout(() => navigate("/"), 500);
    } else setError(result.message || "Registration failed. Please try again.");
  };

  return (
    <div className="auth-container">
      <div className="auth-shell"><div className="eyebrow">Start prepared</div><h1>Build your safety circle.</h1><p>Set up your private account in under a minute.</p></div>
      <div className="card auth-card">
        {error && <div className="alert-banner alert-banner-danger" role="alert">{error}</div>}
        {success && <div className="alert-banner alert-banner-success" role="status">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label" htmlFor="name">Full name</label><input id="name" className="form-control" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} disabled={loading} required /></div>
          <div className="form-group"><label className="form-label" htmlFor="email">Email <span className="muted">(optional if using phone)</span></label><input id="email" type="email" className="form-control" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} /></div>
          <div className="form-group"><label className="form-label" htmlFor="phone">Phone <span className="muted">(optional if using email)</span></label><input id="phone" type="tel" className="form-control" placeholder="+1 555 000 0000" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={loading} /></div>
          <div className="form-group"><label className="form-label" htmlFor="register-password">Password</label><input id="register-password" type="password" className="form-control" placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} required /><div className="password-hint">Use a password you do not reuse elsewhere.</div></div>
          <div className="form-group"><label className="form-label" htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" className="form-control" placeholder="Repeat your password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={loading} required /></div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
        </form>
        <p className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
};

export default Register;
