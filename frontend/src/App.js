import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Logs from "./pages/Logs";
import RunDetails from "./pages/RunDetails";
import RunForm from "./pages/AddRun";
import LoginPage from "./pages/LoginPage";

import Sidebar from "./components/Sidebar";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Load user from localStorage
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  // Login function
  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);

    // Save user permanently
    localStorage.setItem("user", JSON.stringify(loggedInUser));

    navigate("/dashboard");
  };

  // Logout function
  const handleLogout = () => {
    setUser(null);

    // Remove saved login
    localStorage.removeItem("user");

    navigate("/");
  };

  const hideSidebar = location.pathname === "/";

  return (
    <div style={{ display: "flex" }}>
      
      {/* Sidebar */}
      {!hideSidebar && user && (
        <Sidebar user={user} onLogout={handleLogout} />
      )}

      <div style={{ flex: 1 }}>
        <Routes>

          {/* Login */}
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/dashboard" />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              user ? <Dashboard /> : <Navigate to="/" />
            }
          />

          <Route
            path="/logs"
            element={
              user ? <Logs /> : <Navigate to="/" />
            }
          />

          <Route
            path="/runs/:id"
            element={
              user ? <RunDetails /> : <Navigate to="/" />
            }
          />

          <Route
            path="/add"
            element={
              user ? <RunForm /> : <Navigate to="/" />
            }
          />

        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}