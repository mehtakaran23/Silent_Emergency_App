import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (isAuthenticated) navigate("/");
    if (searchParams.get("expired") === "true") setError("Your session expired. Sign in again to continue.");
  }, [isAuthenticated, navigate, searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!identifier || !password) {
      setError("Enter your email or phone and password.");
      return;
    }
    const result = await login(identifier, password);
    if (result.success) {
      setSuccess("Signed in. Opening your safety dashboard...");
      window.setTimeout(() => navigate("/"), 500);
    } else {
      setError(result.message || "Invalid email or password.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-shell"><div className="eyebrow">Welcome back</div><h1>Your safety, in view.</h1><p>Sign in to manage your trusted contacts and alerts.</p></div>
      <div className="card auth-card">
        {error && <div className="alert-banner alert-banner-danger" role="alert">{error}</div>}
        {success && <div className="alert-banner alert-banner-success" role="status">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label" htmlFor="identifier">Email or phone</label><input id="identifier" type="text" className="form-control" placeholder="you@example.com" value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={loading} autoComplete="username" required /></div>
          <div className="form-group"><label className="form-label" htmlFor="password">Password</label><input id="password" type="password" className="form-control" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} autoComplete="current-password" required /></div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? "Signing in..." : "Sign in securely"}</button>
        </form>
        <p className="auth-footer">New to Silent SOS? <Link to="/register">Create an account</Link></p>
      </div>
    </div>
  );
};

export default Login;
