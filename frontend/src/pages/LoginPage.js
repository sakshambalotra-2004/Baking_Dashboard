import { useState } from "react";
import { useNavigate } from "react-router-dom";

/* ─── Hardcoded users ────────────────────────────────────── */
export const USERS = [
  { id: 1, username: "admin",    password: "admin123",    name: "Arjun Mehta",    role: "admin" },
  { id: 2, username: "operator", password: "op1234",      name: "Priya Sharma",   role: "operator" },
  { id: 3, username: "analyst",  password: "analyst99",   name: "Rahul Verma",    role: "analyst" },
  { id: 4, username: "viewer",   password: "view2024",    name: "Sneha Iyer",     role: "viewer" },
];

/* ─── Login CSS ──────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');

  .login-root {
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    background: #F7F5F0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  /* Decorative side panel */
  .login-wrap {
    display: flex;
    width: 100%;
    max-width: 840px;
    min-height: 520px;
    background: #fff;
    border: 1px solid #E8E5DE;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 24px rgba(0,0,0,0.06);
  }

  .login-brand {
    width: 320px;
    min-width: 320px;
    background: #BA7517;
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }
  .login-brand::before {
    content: '';
    position: absolute;
    width: 280px; height: 280px;
    border-radius: 50%;
    background: rgba(255,255,255,0.07);
    top: -80px; right: -80px;
  }
  .login-brand::after {
    content: '';
    position: absolute;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
    bottom: -40px; left: -60px;
  }

  .login-brand-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }
  .login-brand-icon {
    width: 40px; height: 40px;
    background: rgba(255,255,255,0.22);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700;
    color: #fff;
    font-family: 'IBM Plex Mono', monospace;
  }
  .login-brand-name {
    font-size: 18px; font-weight: 700; color: #fff; letter-spacing: -0.3px;
  }
  .login-brand-tagline {
    font-size: 11px; color: rgba(255,255,255,0.7);
    font-family: 'IBM Plex Mono', monospace;
  }

  .login-brand-body {
    position: relative; z-index: 1;
  }
  .login-brand-headline {
    font-size: 26px; font-weight: 700; color: #fff;
    letter-spacing: -0.5px; line-height: 1.25;
    margin: 0 0 12px;
  }
  .login-brand-desc {
    font-size: 13px; color: rgba(255,255,255,0.75);
    line-height: 1.65; margin: 0;
  }

  .login-brand-stats {
    display: flex; gap: 24px; position: relative; z-index: 1;
  }
  .login-brand-stat-val {
    font-size: 22px; font-weight: 700; color: #fff;
    font-family: 'IBM Plex Mono', monospace; line-height: 1;
  }
  .login-brand-stat-lbl {
    font-size: 10px; color: rgba(255,255,255,0.65);
    margin-top: 3px; text-transform: uppercase; letter-spacing: 0.07em;
  }

  /* Form side */
  .login-form-side {
    flex: 1;
    padding: 44px 48px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .login-form-title {
    font-size: 22px; font-weight: 700; color: #1a1a1a;
    letter-spacing: -0.4px; margin: 0 0 4px;
  }
  .login-form-sub {
    font-size: 13px; color: #888; margin: 0 0 32px;
  }

  .login-field {
    margin-bottom: 16px;
  }
  .login-label {
    display: block;
    font-size: 12px; font-weight: 600; color: #555;
    text-transform: uppercase; letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .login-input {
    width: 100%; box-sizing: border-box;
    padding: 10px 13px;
    border: 1px solid #DDD;
    border-radius: 8px;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    color: #1a1a1a;
    background: #fff;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .login-input:focus {
    border-color: #BA7517;
    box-shadow: 0 0 0 3px rgba(186,117,23,0.12);
  }
  .login-input--error {
    border-color: #D85A30;
  }

  .login-pw-wrap {
    position: relative;
  }
  .login-pw-toggle {
    position: absolute; right: 11px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    font-size: 13px; color: #AAA; padding: 2px;
    transition: color 0.12s;
  }
  .login-pw-toggle:hover { color: #BA7517; }

  .login-error-msg {
    background: #FDECEA;
    border: 1px solid #F5C6C3;
    border-radius: 7px;
    padding: 9px 13px;
    font-size: 12px; color: #B33;
    margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }

  .login-btn {
    width: 100%;
    padding: 11px;
    background: #BA7517;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: opacity 0.15s;
    margin-top: 4px;
  }
  .login-btn:hover:not(:disabled) { opacity: 0.88; }
  .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .login-hint-row {
    margin-top: 24px;
    border-top: 1px solid #F0EDE6;
    padding-top: 18px;
  }
  .login-hint-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: #AAA; margin-bottom: 8px;
  }
  .login-hint-pills {
    display: flex; flex-wrap: wrap; gap: 6px;
  }
  .login-hint-pill {
    font-size: 11px;
    background: #FAFAF8;
    border: 1px solid #E8E5DE;
    border-radius: 5px;
    padding: 4px 9px;
    cursor: pointer;
    color: #555;
    font-family: 'IBM Plex Mono', monospace;
    transition: background 0.12s, border-color 0.12s;
  }
  .login-hint-pill:hover { background: #FEF9F0; border-color: #BA7517; color: #BA7517; }

  @media (max-width: 700px) {
    .login-brand { display: none; }
    .login-form-side { padding: 36px 28px; }
  }
`;

/* ─── Role badge colors ──────────────────────────────────── */
const ROLE_STYLE = {
  admin:    { bg: "#FEF0D6", color: "#9A6010" },
  operator: { bg: "#DFF5EE", color: "#157A58" },
  analyst:  { bg: "#E8F1FD", color: "#2B5FA5" },
  viewer:   { bg: "#F0EDE6", color: "#666"    },
};

/* ─── LoginPage component ────────────────────────────────── */
export default function LoginPage({ onLogin }) {
    const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = () => {
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");

    // Simulate async auth
    setTimeout(() => {
      const user = USERS.find(
        (u) => u.username === username.trim() && u.password === password
      );
      if (user) {
        onLogin?.(user);
        navigate("/dashboard");
      } else {
        setError("Invalid username or password. Try one of the demo accounts below.");
      }
      setLoading(false);
    }, 500);
  };

  const fillUser = (u) => {
    setUsername(u.username);
    setPassword(u.password);
    setError("");
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="login-root">
        <div className="login-wrap">

          {/* ── Brand side ── */}
          <div className="login-brand">
            <div className="login-brand-logo">
              <div className="login-brand-icon">BR</div>
              <div>
                <div className="login-brand-name">BakeRun</div>
                <div className="login-brand-tagline">Industrial Dashboard</div>
              </div>
            </div>

            <div className="login-brand-body">
              <h2 className="login-brand-headline">
                Phase-by-Phase<br />Baking Intelligence
              </h2>
              <p className="login-brand-desc">
                Monitor carbide and source powder runs in real time. Track temperatures, pressures, and phase step data — all in one place.
              </p>
            </div>

            <div className="login-brand-stats">
              <div>
                <div className="login-brand-stat-val">3</div>
                <div className="login-brand-stat-lbl">Phases tracked</div>
              </div>
              <div>
                <div className="login-brand-stat-val">2</div>
                <div className="login-brand-stat-lbl">Material types</div>
              </div>
              <div>
                <div className="login-brand-stat-val">∞</div>
                <div className="login-brand-stat-lbl">Run history</div>
              </div>
            </div>
          </div>

          {/* ── Form side ── */}
          <div className="login-form-side">
            <h1 className="login-form-title">Welcome back</h1>
            <p className="login-form-sub">Sign in to your operator account</p>

            {error && (
              <div className="login-error-msg">
                ⚠️ {error}
              </div>
            )}

            <div className="login-field">
              <label className="login-label" htmlFor="login-username">Username</label>
              <input
                id="login-username"
                className={`login-input${error ? " login-input--error" : ""}`}
                type="text"
                placeholder="e.g. operator"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">Password</label>
              <div className="login-pw-wrap">
                <input
                  id="login-password"
                  className={`login-input${error ? " login-input--error" : ""}`}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  autoComplete="current-password"
                />
                <button
                  className="login-pw-toggle"
                  onClick={() => setShowPw((s) => !s)}
                  tabIndex={-1}
                  type="button"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              className="login-btn"
              onClick={handleSubmit}
              disabled={loading}
              type="button"
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>

            {/* Demo hint */}
            <div className="login-hint-row">
              <div className="login-hint-title">Demo accounts — click to fill</div>
              <div className="login-hint-pills">
                {USERS.map((u) => (
                  <button
                    key={u.id}
                    className="login-hint-pill"
                    onClick={() => fillUser(u)}
                    type="button"
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 7, height: 7,
                        borderRadius: "50%",
                        background: ROLE_STYLE[u.role]?.bg ?? "#ddd",
                        border: `1px solid ${ROLE_STYLE[u.role]?.color ?? "#aaa"}`,
                        marginRight: 5,
                        verticalAlign: "middle",
                      }}
                    />
                    {u.username}
                    <span style={{
                      marginLeft: 5,
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: ROLE_STYLE[u.role]?.bg,
                      color: ROLE_STYLE[u.role]?.color,
                    }}>
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}