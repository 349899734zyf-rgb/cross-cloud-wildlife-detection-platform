import { useLocation } from "react-router-dom";
import { logout } from "../services/auth";
import "./Navbar.css";

function Navbar({ user }) {
  const location = useLocation();

  async function handleLogout() {
    try {
      await logout();
    } catch (e) {}
    window.location.href = "/";
  }

  const cls = (path) =>
    "app-nav-link" + (location.pathname === path ? " active" : "");

  return (
    <nav className="app-nav">
      <span
        className="app-nav-logo"
        onClick={() => {
          window.location.href = "/";
        }}
      >
        AussieEcoLens
      </span>
      <div className="app-nav-links">
        <a href="/upload" className={cls("/upload")}>
          Upload
        </a>
        <a href="/search" className={cls("/search")}>
          Search
        </a>
        <a href="/tags" className={cls("/tags")}>
          Tags
        </a>
        <a href="/subscribe" className={cls("/subscribe")}>
          Subscribe
        </a>
        <button className="app-nav-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
