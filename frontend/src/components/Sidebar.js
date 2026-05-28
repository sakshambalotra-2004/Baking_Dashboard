import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

/* ───────────────── CSS ───────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

.sb-sidebar {
  width: 260px;
  min-width: 260px;
  height: 100vh;
  background: #ffffff;
  border-right: 1px solid #E8E5DE;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 14px;
  box-sizing: border-box;
  position: sticky;
  top: 0;
}

/* Logo */
.sb-logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.sb-logo-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #BA7517;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
}

.sb-logo-text {
  display: flex;
  flex-direction: column;
}

.sb-logo-name {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}

.sb-logo-tagline {
  font-size: 11px;
  color: #999;
}

/* Toggle */
.sb-toggle {
  position: absolute;
  top: 22px;
  right: -12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #E8E5DE;
  background: white;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sb-toggle:hover {
  background: #F5F3EE;
}

/* Navigation */
.sb-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.sb-section-label {
  font-size: 11px;
  font-weight: 700;
  color: #999;
  padding-left: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.sb-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  text-decoration: none;
  color: #444;
  font-size: 14px;
  font-weight: 600;
  transition: 0.2s;
}

.sb-nav-item:hover {
  background: #F5F3EE;
  color: #BA7517;
}

.sb-nav-item--active {
  background: #FEF4E8;
  color: #BA7517;
}

.sb-nav-icon {
  font-size: 18px;
}

.sb-nav-label {
  white-space: nowrap;
}

/* Divider */
.sb-divider {
  height: 1px;
  background: #ECE8DF;
  margin: 14px 0;
}

/* User section */
.sb-user-area {
  border-top: 1px solid #ECE8DF;
  padding-top: 18px;
}

.sb-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #BA7517;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  margin-bottom: 12px;
}

.sb-user-info {
  margin-bottom: 14px;
}

.sb-user-name {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a1a;
}

.sb-user-role {
  font-size: 12px;
  color: #888;
}

/* Logout button */
.sb-logout-btn {
  width: 100%;
  background: #D85A30;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s;
}

.sb-logout-btn:hover {
  opacity: 0.9;
}

/* Collapse */
.sb-sidebar--collapsed {
  width: 85px;
  min-width: 85px;
}

.sb-sidebar--collapsed .sb-logo-text,
.sb-sidebar--collapsed .sb-nav-label,
.sb-sidebar--collapsed .sb-user-info,
.sb-sidebar--collapsed .sb-section-label {
  display: none;
}
`;

/* ───────────────── Navigation ───────────────── */
const NAV = [
  {
    section: "Main",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "📋" },
      { label: "All Runs", to: "/logs", icon: "🔬" },
      { label: "Add New Run", to: "/add", icon: "➕" },
    ],
  },
];

/* ───────────────── Sidebar ───────────────── */
export default function Sidebar({ user, onLogout }) {

  const [collapsed, setCollapsed] = useState(false);

  const location = useLocation();

  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "OP";

  return (
    <>
      <style>{CSS}</style>

      <aside
        className={`sb-sidebar ${
          collapsed ? "sb-sidebar--collapsed" : ""
        }`}
      >

        {/* Logo */}
        <div>

          <div className="sb-logo-area">
            <div className="sb-logo-icon">BR</div>

            <div className="sb-logo-text">
              <div className="sb-logo-name">BakeRun</div>
              <div className="sb-logo-tagline">
                Industrial Dashboard
              </div>
            </div>
          </div>

          {/* Toggle */}
          <button
            className="sb-toggle"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "›" : "‹"}
          </button>

          {/* Navigation */}
          <nav className="sb-nav">

            {NAV.map((section) => (
              <div key={section.section}>

                <div className="sb-section-label">
                  {section.section}
                </div>

                {section.items.map((item) => {

                  const isActive =
                    location.pathname === item.to;

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`sb-nav-item ${
                        isActive
                          ? "sb-nav-item--active"
                          : ""
                      }`}
                    >
                      <span className="sb-nav-icon">
                        {item.icon}
                      </span>

                      <span className="sb-nav-label">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}

                <div className="sb-divider" />

              </div>
            ))}

          </nav>

        </div>

        {/* User */}
        <div className="sb-user-area">

          <div className="sb-avatar">
            {initials}
          </div>

          <div className="sb-user-info">
            <div className="sb-user-name">
              {user?.name ?? "Operator"}
            </div>

            <div className="sb-user-role">
              {user?.role ?? "operator"}
            </div>
          </div>

          <button
            className="sb-logout-btn"
            onClick={onLogout}
          >
            Logout
          </button>

        </div>

      </aside>
    </>
  );
}