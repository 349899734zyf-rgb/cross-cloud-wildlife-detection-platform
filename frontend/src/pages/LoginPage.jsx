import { useState } from "react";
import { signIn, signUp, confirmSignUp, getCurrentUser } from "../services/auth";

function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login", "register", "confirm"
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
      const result = await signIn(email, password);
      if (!result.isSignedIn) {
        if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
          setMode("confirm");
          setError("Please verify your email first.");
        } else {
          setError("Sign-in incomplete. Please try again.");
        }
        return;
      }
      const user = await getCurrentUser();
      onLogin(user);
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

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🌿 AussieEcoLens</h1>
        <p>Wildlife Observation Platform</p>

        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <div className="toggle-link">
              No account?{" "}
              <span onClick={() => { setMode("register"); setError(""); }}>
                Register
              </span>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Given Name</label>
              <input
                type="text"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Family Name</label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, upper+lower+number+symbol"
                required
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>
            <div className="toggle-link">
              Have an account?{" "}
              <span onClick={() => { setMode("login"); setError(""); }}>
                Sign In
              </span>
            </div>
          </form>
        )}

        {mode === "confirm" && (
          <form onSubmit={handleConfirm}>
            <p>Check your email for a verification code.</p>
            <div className="form-group">
              <label>Verification Code</label>
              <input
                type="text"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Confirming..." : "Confirm"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
