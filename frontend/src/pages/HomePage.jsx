import { useNavigate } from "react-router-dom";
import "./HomePage.css";

const NAV_BUTTONS = [
  {
    label: "Upload",
    hint: "Upload your pictures",
    animal: "/images/kangaroo_4.PNG",
    animalClass: "upload-pop-animal",
    path: "/upload"
  },
  {
    label: "Search",
    hint: "Search the wild",
    animal: "/images/ibis_2.PNG",
    animalClass: "search-pop-animal",
    path: "/search"
  },
  {
    label: "Tags",
    hint: "Manage your tags",
    animal: "/images/koala_2.PNG",
    animalClass: "tags-pop-animal",
    path: "/tags"
  },
  {
    label: "Subscribe",
    hint: "Get notified",
    animal: "/images/quokka_1.PNG",
    animalClass: "subscribe-pop-animal",
    path: "/subscribe"
  }
];

function HomePage({ user, onLogout }) {
  const navigate = useNavigate();

  function handleNavClick(path) {
    user ? navigate(path) : navigate("/login");
  }

  return (
    <div className="home-page">
      {/* ── Navbar ── */}
      <nav className="home-nav">
        <span className="home-nav-logo">AussieEcoLens</span>

        <div className="home-nav-right">
          <span className="home-nav-tagline">
            Your Personal Australian Wildlife Journal
          </span>

          {user ? (
            <button className="home-nav-btn" onClick={onLogout}>
              Logout
            </button>
          ) : (
            <button className="home-nav-btn" onClick={() => navigate("/login")}>
              Get Started
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="home-hero">
        <h1 className="home-hero-title">Discover Australia's Wildlife</h1>
      </section>

      {/* ── Four nav buttons ── */}
      <section className="home-buttons">
        {NAV_BUTTONS.map((btn) => (
          <div key={btn.label} className="home-btn-wrapper">
            <img
              src={btn.animal}
              alt=""
              className={`home-btn-animal ${btn.animalClass}`}
            />

            <button
              className="home-btn"
              onClick={() => handleNavClick(btn.path)}
            >
              {btn.label}
            </button>

            <span className="home-btn-hint">{btn.hint}</span>
          </div>
        ))}
      </section>

      {/* ── Bottom scene ── */}
      <section className="home-scene">
        {/* Layer 1: trees */}
        <img
          src="/images/big_tree.PNG"
          alt=""
          className="scene-tree tree-right"
        />

        <img
          src="/images/small_tree.PNG"
          alt=""
          className="scene-tree tree-left"
        />

        {/* Layer 2: animals */}
        <img
          src="/images/kangaroo_1.PNG"
          alt="kangaroo"
          className="scene-animal animal-kangaroo"
        />

        <img
          src="/images/quokka_2.PNG"
          alt="quokka"
          className="scene-animal animal-quokka"
        />

        <img
          src="/images/ibis_1.PNG"
          alt="ibis"
          className="scene-animal animal-ibis"
        />

        <img
          src="/images/koala_1.PNG"
          alt="koala"
          className="scene-animal animal-koala"
        />
      </section>
    </div>
  );
}

export default HomePage;
