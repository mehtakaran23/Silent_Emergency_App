import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
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
    // If user is already authenticated, redirect to dashboard
    if (isAuthenticated) {
      navigate("/");
    }

    // Check for expired session flag
    if (searchParams.get("expired") === "true") {
      setError("Your session has expired. Please log in again.");
    }
  }, [isAuthenticated, navigate, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!identifier || !password) {
      setError("Please fill in all fields.");
      return;
    }

    const res = await login(identifier, password);
    if (res.success) {
      setSuccess("Logged in successfully!");
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } else {
      setError(res.message || "Invalid email or password.");
    }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to access your Silent SOS dashboard</p>
        </div>

        {error && <div className="alert-banner alert-banner-danger">{error}</div>}
        {success && <div className="alert-banner alert-banner-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email or phone</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. john@example.com or +15555555555"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }} disabled={loading}>
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>

        <p style={{ marginTop: "24px", fontSize: "14px" }}>
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
