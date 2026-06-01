import { useState } from "react";
import { SPECIES_LIST } from "../utils/species";
import { addTags, removeTags } from "../services/api";

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
        if (entry.species) {
          tags[entry.species] = parseInt(entry.count) || 1;
        }
      });

      if (!fileUrl || Object.keys(tags).length === 0) {
        setError("File URL and at least one tag are required");
        setLoading(false);
        return;
      }

      let res;
      if (action === "add") {
        res = await addTags(fileUrl, tags);
      } else {
        res = await removeTags(fileUrl, tags);
      }

      console.log(`${action} tags for ${fileUrl}:`, tags);
      setResult({
        message: `Tags ${action}ed successfully`,
        tags: res.tags || tags,
      });
    } catch (err) {
      setError(err.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Manage Tags</h1>

      <div className="card">
        {/* Action selector */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <button
            className={`btn ${action === "add" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setAction("add")}
          >
            Add Tags
          </button>
          <button
            className={`btn ${action === "remove" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setAction("remove")}
          >
            Remove Tags
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* File URL */}
          <div className="form-group">
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
          <div style={{ marginTop: "1rem" }}>
            <label>Tags to {action}</label>
            {tagEntries.map((entry, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                  alignItems: "end",
                }}
              >
                <div style={{ flex: 2 }}>
                  <select
                    value={entry.species}
                    onChange={(e) => updateEntry(index, "species", e.target.value)}
                  >
                    <option value="">Select species...</option>
                    {SPECIES_LIST.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    min="1"
                    value={entry.count}
                    onChange={(e) => updateEntry(index, "count", e.target.value)}
                  />
                </div>
                {tagEntries.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => removeEntry(index)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addEntry}
              style={{ marginTop: "0.5rem" }}
            >
              + Add Another Tag
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
            disabled={loading}
          >
            {loading ? "Processing..." : `${action === "add" ? "Add" : "Remove"} Tags`}
          </button>
        </form>

        {result && (
          <div className="success-msg" style={{ marginTop: "1rem" }}>
            <div>{result.message}</div>
            <pre style={{ marginTop: "0.5rem", fontSize: "0.85rem", background: "rgba(0,0,0,0.05)", padding: "0.5rem", borderRadius: "3px" }}>
              {JSON.stringify(result.tags, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default TagManagePage;
