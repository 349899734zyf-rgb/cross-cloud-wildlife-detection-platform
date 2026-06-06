import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp, confirmSignUp } from "../services/auth";
import "./LoginPage.css";

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await signIn(email, password);
      onLogin(user);
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signUp(email, password, givenName, familyName);
      setMode("confirm");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await confirmSignUp(email, confirmCode);
      setMode("login");
    } catch (err) {
      setError(err.message || "Confirmation failed");
    } finally {
      setLoading(false);
    }
  }

  const titles = {
    login: "Log in",
    register: "Create Account",
    confirm: "Verify Email"
  };

  return (
    <div className="lp-page">
      {/* ── Left: map + animated animals ── */}
      <div className="lp-left">
        <img src="/images/map.PNG" alt="Australia" className="lp-map" />
        <img
          src="/images/quokka_1.PNG"
          alt=""
          className="lp-animal lp-quokka"
        />
        <img src="/images/ibis_1.PNG" alt="" className="lp-animal lp-ibis" />
        <img
          src="/images/kangaroo_2.PNG"
          alt=""
          className="lp-animal lp-kangaroo"
        />
        <img src="/images/koala_1.PNG" alt="" className="lp-animal lp-koala" />
      </div>

      {/* ── Divider ── */}
      <div className="lp-divider" />

      {/* ── Right: logo + form ── */}
      <div className="lp-right">
        <span className="lp-logo">AussieEcoLens</span>

        <div className="lp-form-area">
          <h2 className="lp-mode-title">{titles[mode]}</h2>

          {/* LOGIN */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="lp-form">
              <div className="lp-field">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div className="lp-field">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              {error && <div className="lp-error">{error}</div>}
              <button className="lp-btn" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
              <p className="lp-toggle">
                No account?{" "}
                <span
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  Create account
                </span>
              </p>
            </form>
          )}

          {/* REGISTER */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="lp-form">
              <div className="lp-field">
                <label>Given Name</label>
                <input
                  type="text"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  required
                />
              </div>
              <div className="lp-field">
                <label>Family Name</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                />
              </div>
              <div className="lp-field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="lp-field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, upper+lower+number+symbol"
                  required
                />
              </div>
              {error && <div className="lp-error">{error}</div>}
              <button className="lp-btn" disabled={loading}>
                {loading ? "Registering…" : "Register"}
              </button>
              <p className="lp-toggle">
                Already have one?{" "}
                <span
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Sign In
                </span>
              </p>
            </form>
          )}

          {/* CONFIRM */}
          {mode === "confirm" && (
            <form onSubmit={handleConfirm} className="lp-form">
              <p className="lp-confirm-msg">
                Check your email for a verification code.
              </p>
              <div className="lp-field">
                <label>Verification Code</label>
                <input
                  type="text"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>
              {error && <div className="lp-error">{error}</div>}
              <button className="lp-btn" disabled={loading}>
                {loading ? "Confirming…" : "Confirm"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
