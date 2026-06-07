import { useState, useEffect } from "react";
import { SPECIES_LIST } from "../utils/species";
import { subscribe, unsubscribe, getSubscriptions } from "../services/api";
import Navbar from "../components/Navbar";
import "./SubscribePage.css";

function SubscribePage({ user }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSpecies, setSelectedSpecies] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userId = user?.userId || user?.username || "unknown";
  const userEmail =
    user?.signInDetails?.loginId ||
    user?.email ||
    user?.attributes?.email ||
    "";

  useEffect(() => {
    if (userId !== "unknown") loadSubscriptions();
  }, [userId]);

  async function loadSubscriptions() {
    try {
      const res = await getSubscriptions(userId);
      setSubscriptions(res.subscriptions || []);
    } catch (err) {
      setError("Failed to load subscriptions");
    }
  }

  async function handleSubscribe(e) {
    e.preventDefault();
    if (!selectedSpecies) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (!userEmail)
        throw new Error("User email is required to subscribe for alerts");
      await subscribe(userId, userEmail, selectedSpecies);
      setSubscriptions((prev) => [
        ...prev,
        { tag_name: selectedSpecies, email: userEmail }
      ]);
      setSuccess(
        `Subscribed to ${selectedSpecies}. Check your email for the AWS SNS confirmation!`
      );
      setSelectedSpecies("");
    } catch (err) {
      setError(err.message || "Failed to subscribe");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe(tagName) {
    try {
      await unsubscribe(userId, tagName);
      setSubscriptions((prev) => prev.filter((s) => s.tag_name !== tagName));
      setSuccess(`Unsubscribed from ${tagName}`);
    } catch (err) {
      setError(err.message || "Failed to unsubscribe");
    }
  }

  const subscribedTags = new Set(subscriptions.map((s) => s.tag_name));
  const availableSpecies = SPECIES_LIST.filter(
    (s) => !subscribedTags.has(s.value)
  );

  return (
    <div className="sub-page">
      <Navbar user={user} />

      <div className="sub-body">
        {/* ── Decorative quokka — z-index 0, behind cards ── */}
        <img src="/images/quokka_1.PNG" alt="" className="sub-deco-quokka" />

        <h1 className="sub-title">Tag Notifications</h1>

        {/* ── Card 1: Subscribe form ── */}
        <div className="sub-card">
          <h2 className="sub-card-title">Subscribe to Species Alerts</h2>
          <p className="sub-card-desc">
            Get notified via email when a subscribed species is detected in a
            new upload.
          </p>

          <form onSubmit={handleSubscribe} className="sub-form">
            <div className="sub-field">
              <label>Species</label>
              <select
                value={selectedSpecies}
                onChange={(e) => setSelectedSpecies(e.target.value)}
              >
                <option value="">Select species to subscribe...</option>
                {availableSpecies.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.value}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="sub-btn-primary"
              disabled={loading || !selectedSpecies}
            >
              {loading ? "..." : "Subscribe"}
            </button>
          </form>

          {error && <div className="sub-error">{error}</div>}
          {success && <div className="sub-success">{success}</div>}
        </div>

        {/* ── Card 2: Current subscriptions ── */}
        <div className="sub-card">
          <h2 className="sub-card-title">
            Your Subscriptions ({subscriptions.length})
          </h2>

          {subscriptions.length === 0 ? (
            <p className="sub-empty">
              No active subscriptions. Subscribe to a species above to receive
              alerts.
            </p>
          ) : (
            <div className="sub-list">
              {subscriptions.map((sub) => {
                return (
                  <div key={sub.tag_name} className="sub-item">
                    <div>
                      <div className="sub-item-name">{sub.tag_name}</div>
                    </div>
                    <button
                      className="sub-btn-unsub"
                      onClick={() => handleUnsubscribe(sub.tag_name)}
                    >
                      Unsubscribe
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubscribePage;
