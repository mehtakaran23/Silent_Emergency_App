import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./layouts/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import EmergencyContacts from "./pages/EmergencyContacts";
import SOS from "./pages/SOS";
import AlertHistory from "./pages/AlertHistory";
import ContactResponse from "./pages/ContactResponse";

function HomeRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="spinner" />;
  return isAuthenticated ? (
    <ProtectedRoute><Dashboard /></ProtectedRoute>
  ) : <Landing />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/respond/:token" element={<ContactResponse />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <HomeRoute />
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <EmergencyContacts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sos"
              element={
                <ProtectedRoute>
                  <SOS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <AlertHistory />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
