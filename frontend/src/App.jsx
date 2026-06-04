import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import UploadPage from "./pages/UploadPage";
import SearchPage from "./pages/SearchPage";
import TagManagePage from "./pages/TagManagePage";
import SubscribePage from "./pages/SubscribePage";
import { useState, useEffect } from "react";
import { getCurrentUser, logout } from "./services/auth";
import "./App.css";

function ProtectedRoute({ children, user }) {
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <div className="app">
        {user && (
          <nav className="navbar">
            <div className="nav-brand">AussieEcoLens</div>
            <div className="nav-links">
              <Link to="/upload">Upload</Link>
              <Link to="/search">Search</Link>
              <Link to="/tags">Tags</Link>
              <Link to="/subscribe">Subscribe</Link>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </nav>
        )}
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/upload" replace />
              ) : (
                <LoginPage onLogin={setUser} />
              )
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute user={user}>
                <UploadPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute user={user}>
                <SearchPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tags"
            element={
              <ProtectedRoute user={user}>
                <TagManagePage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscribe"
            element={
              <ProtectedRoute user={user}>
                <SubscribePage user={user} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
