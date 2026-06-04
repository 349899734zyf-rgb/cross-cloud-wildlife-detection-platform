import { useState } from "react";
import { SPECIES_LIST } from "../utils/species";
import { addTags, removeTags } from "../services/api";

function TagManagePage() {
  const [fileUrls, setFileUrls] = useState([""]);
  const [action, setAction] = useState("add");
  const [tagEntries, setTagEntries] = useState([{ species: "", count: 1 }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // --- URL list management ---
  function addUrlField() {
    setFileUrls([...fileUrls, ""]);
  }
  function removeUrlField(index) {
    setFileUrls(fileUrls.filter((_, i) => i !== index));
  }
  function updateUrl(index, value) {
    const updated = [...fileUrls];
    updated[index] = value;
    setFileUrls(updated);
  }

  // --- Tag entries management ---
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
      const urls = fileUrls.map(u => u.trim()).filter(Boolean);
      if (urls.length === 0) {
        setError("At least one file URL is required");
        setLoading(false);
        return;
      }

      const tags = {};
      tagEntries.forEach((entry) => {
        if (entry.species) tags[entry.species] = parseInt(entry.count) || 1;
      });
      if (Object.keys(tags).length === 0) {
        setError("At least one tag is required");
        setLoading(false);
        return;
      }

      const res = action === "add"
        ? await addTags(urls, tags)
        : await removeTags(urls, tags);

      setResult(res);
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
          {["add", "remove"].map((a) => (
            <button
              key={a}
              className={`btn ${action === a ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setAction(a)}
            >
              {a === "add" ? "Add Tags" : "Remove Tags"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* File URLs */}
          <div className="form-group">
            <label>File URLs <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>(supports multiple files)</span></label>
            {fileUrls.map((url, index) => (
              <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => updateUrl(index, e.target.value)}
                  placeholder="https://ecolens-uploads-....s3.amazonaws.com/..."
                  style={{ flex: 1 }}
                />
                {fileUrls.length > 1 && (
                  <button type="button" className="btn btn-secondary" onClick={() => removeUrlField(index)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addUrlField} style={{ marginTop: "0.3rem" }}>
              + Add Another File
            </button>
          </div>

          {/* Tag entries */}
          <div style={{ marginTop: "1rem" }}>
            <label>Tags to {action}</label>
            {tagEntries.map((entry, index) => (
              <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "end" }}>
                <div style={{ flex: 2 }}>
                  <select
                    value={entry.species}
                    onChange={(e) => updateEntry(index, "species", e.target.value)}
                  >
                    <option value="">Select species...</option>
                    {SPECIES_LIST.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
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
                  <button type="button" className="btn btn-secondary" onClick={() => removeEntry(index)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addEntry} style={{ marginTop: "0.5rem" }}>
              + Add Another Tag
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={loading}>
            {loading ? "Processing..." : `${action === "add" ? "Add" : "Remove"} Tags`}
          </button>
        </form>

        {result && (
          <div className="success-msg" style={{ marginTop: "1rem" }}>
            <div>{result.message}</div>
            {result.updated && result.updated.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                {result.updated.map((item, i) => (
                  <div key={i} style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
                    <span style={{ wordBreak: "break-all" }}>✅ {item.file_url.split("/").pop()}</span>
                    <pre style={{ background: "rgba(0,0,0,0.05)", padding: "0.3rem 0.5rem", borderRadius: "3px", marginTop: "0.2rem" }}>
                      {JSON.stringify(item.tags, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
            {result.not_found && result.not_found.length > 0 && (
              <div style={{ marginTop: "0.5rem", color: "var(--error)", fontSize: "0.85rem" }}>
                Not found: {result.not_found.length} file(s)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TagManagePage;
