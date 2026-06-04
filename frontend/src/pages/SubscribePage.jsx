import { useState, useEffect } from "react";
import { SPECIES_LIST } from "../utils/species";
import { subscribe, unsubscribe, getSubscriptions } from "../services/api";

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
    if (userId !== "unknown") {
      loadSubscriptions();
    }
  }, [userId]);

  async function loadSubscriptions() {
    try {
      console.log("Loading subscriptions for user:", userId);
      const res = await getSubscriptions(userId);
      setSubscriptions(res.subscriptions || []);
    } catch (err) {
      console.error("Failed to load subscriptions:", err);
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
      console.log("Subscribing to:", selectedSpecies);
      if (!userEmail) {
        throw new Error("User email is required to subscribe for alerts");
      }
      await subscribe(userId, userEmail, selectedSpecies);
      setSubscriptions((prev) => [
        ...prev,
        { tag_name: selectedSpecies, email: userEmail }
      ]);
      setSuccess(
        `Subscribed to ${selectedSpecies}. Please check your email for the AWS SNS confirmation message!`
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
      console.log("Unsubscribing from:", tagName);
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
    <div className="page">
      <h1>Tag Notifications</h1>

      {/* Subscribe form */}
      <div className="card">
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>
          Subscribe to Species Alerts
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Get notified via email when a subscribed species is detected in a new
          upload.
        </p>

        <form
          onSubmit={handleSubscribe}
          style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}
        >
          <div style={{ flex: 1 }}>
            <label>Species</label>
            <select
              value={selectedSpecies}
              onChange={(e) => setSelectedSpecies(e.target.value)}
            >
              <option value="">Select species to subscribe...</option>
              {availableSpecies.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            disabled={loading || !selectedSpecies}
          >
            {loading ? "..." : "Subscribe"}
          </button>
        </form>

        {error && (
          <div className="error-msg" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}
        {success && (
          <div className="success-msg" style={{ marginTop: "1rem" }}>
            {success}
          </div>
        )}
      </div>

      {/* Current subscriptions */}
      <div className="card">
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>
          Your Subscriptions ({subscriptions.length})
        </h2>

        {subscriptions.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>
            No active subscriptions. Subscribe to a species above to receive
            alerts.
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {subscriptions.map((sub) => {
              const speciesInfo = SPECIES_LIST.find(
                (s) => s.value === sub.tag_name
              );
              return (
                <div
                  key={sub.tag_name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.8rem",
                    background: "var(--bg)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)"
                  }}
                >
                  <div>
                    <strong>{speciesInfo?.label || sub.tag_name}</strong>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)"
                      }}
                    >
                      {sub.tag_name}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleUnsubscribe(sub.tag_name)}
                    style={{ color: "var(--error)" }}
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
  );
}

export default SubscribePage;
