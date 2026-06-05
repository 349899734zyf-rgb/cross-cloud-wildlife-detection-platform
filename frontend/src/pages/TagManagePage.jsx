import { useState } from "react";
import { SPECIES_LIST } from "../utils/species";
import { addTags, removeTags } from "../services/api";
import Navbar from "../components/Navbar";
import "./TagManagePage.css";

function TagManagePage({ user }) {
  const [fileUrl, setFileUrl] = useState("");
  const [action, setAction] = useState("add");
  const [tagEntries, setTagEntries] = useState([{ species: "", count: 1 }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function addEntry() {
    setTagEntries([...tagEntries, { species: "", count: 1 }]);
  }
  function removeEntry(index) {
    setTagEntries(tagEntries.filter((_, i) => i !== index));
  }
  function updateEntry(index, field, value) {
    const updated = [...tagEntries];
    updated[index][field] = value;
    setTagEntries(updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const tags = {};
      tagEntries.forEach((entry) => {
        if (entry.species) tags[entry.species] = parseInt(entry.count) || 1;
      });
      if (!fileUrl || Object.keys(tags).length === 0) {
        setError("File URL and at least one tag are required");
        setLoading(false);
        return;
      }
      const res =
        action === "add"
          ? await addTags(fileUrl, tags)
          : await removeTags(fileUrl, tags);
      setResult({
        message: `Tags ${action}ed successfully`,
        tags: res.tags || tags
      });
    } catch (err) {
      setError(err.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tm-page">
      <Navbar user={user} />

      <div className="tm-body">
        {/* ── Decorative kangaroo — behind card ── */}
        <img src="/images/kangaroo_3.PNG" alt="" className="tm-deco-kangaroo" />

        <h1 className="tm-title">Manage Tags</h1>

        <div className="tm-card">
          {/* Action tabs */}
          <div className="tm-tabs">
            <button
              className={"tm-tab" + (action === "add" ? " tm-tab-active" : "")}
              onClick={() => setAction("add")}
            >
              Add Tags
            </button>
            <button
              className={
                "tm-tab" + (action === "remove" ? " tm-tab-active" : "")
              }
              onClick={() => setAction("remove")}
            >
              Remove Tags
            </button>
          </div>

          <form onSubmit={handleSubmit} className="tm-form">
            {/* File URL */}
            <div className="tm-field">
              <label>File URL</label>
              <input
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://ecolens-uploads-....s3.amazonaws.com/..."
                required
              />
            </div>

            {/* Tag entries */}
            <div className="tm-field" style={{ marginTop: "16px" }}>
              <label>Tags to {action}</label>
              <div className="tm-tag-entries">
                {tagEntries.map((entry, index) => (
                  <div key={index} className="tm-tag-row">
                    <div className="tm-field" style={{ flex: 2 }}>
                      <select
                        value={entry.species}
                        onChange={(e) =>
                          updateEntry(index, "species", e.target.value)
                        }
                      >
                        <option value="">Select species...</option>
                        {SPECIES_LIST.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tm-field" style={{ flex: 1 }}>
                      <input
                        type="number"
                        min="1"
                        value={entry.count}
                        onChange={(e) =>
                          updateEntry(index, "count", e.target.value)
                        }
                      />
                    </div>
                    {tagEntries.length > 1 && (
                      <button
                        type="button"
                        className="tm-btn-remove"
                        onClick={() => removeEntry(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="tm-btn-secondary"
                onClick={addEntry}
              >
                + Add Another Tag
              </button>
            </div>

            {error && <div className="tm-error">{error}</div>}

            <button className="tm-btn-primary" disabled={loading}>
              {loading
                ? "Processing..."
                : action === "add"
                  ? "Add Tags"
                  : "Remove Tags"}
            </button>
          </form>

          {result && (
            <div className="tm-success">
              <div>{result.message}</div>
              <pre className="tm-result-pre">
                {JSON.stringify(result.tags, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TagManagePage;
