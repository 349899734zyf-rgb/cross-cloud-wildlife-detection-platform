import { useState } from "react";
import { SPECIES_LIST } from "../utils/species";
import { queryByTags, queryByThumbnail, queryByFile, deleteFile } from "../services/api";

function SearchPage({ user }) {
  const [queryType, setQueryType] = useState("tags");
  const [tagFilters, setTagFilters] = useState([{ species: "", count: 1 }]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [searchFile, setSearchFile] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addTagFilter() {
    setTagFilters([...tagFilters, { species: "", count: 1 }]);
  }

  function removeTagFilter(index) {
    setTagFilters(tagFilters.filter((_, i) => i !== index));
  }

  function updateTagFilter(index, field, value) {
    const updated = [...tagFilters];
    updated[index][field] = value;
    setTagFilters(updated);
  }

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);

    try {
      let data;

      switch (queryType) {
        case "tags": {
          const tags = {};
          tagFilters.forEach((f) => {
            if (f.species) tags[f.species] = parseInt(f.count) || 1;
          });
          if (Object.keys(tags).length === 0) {
            throw new Error("Please add at least one species tag filter");
          }
          console.log("Query by tags:", tags);
          const res = await queryByTags(tags);
          data = res.results || [];
          break;
        }
        case "thumbnail": {
          if (!thumbnailUrl) {
            throw new Error("Please enter a thumbnail URL");
          }
          console.log("Query by thumbnail URL:", thumbnailUrl);
          const res = await queryByThumbnail(thumbnailUrl);
          data = res.results || [];
          break;
        }
        case "file": {
          if (!searchFile) {
            throw new Error("Please select an image file to query");
          }
          console.log("Query by file:", searchFile.name);
          const formData = new FormData();
          formData.append("file", searchFile);
          const res = await queryByFile(formData);
          data = res.results || [];
          break;
        }
        default:
          data = [];
          break;
      }
      setResults(data);
      if (data.length === 0) {
        setError("No matching records found");
      }
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(fileUrl) {
    if (!window.confirm("Are you sure you want to delete this file? This will remove it from S3 and the database.")) return;
    try {
      await deleteFile(fileUrl);
      setResults((prev) => prev.filter((item) => item.file_url !== fileUrl));
      alert("File deleted successfully");
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  }

  return (
    <div className="page">
      <h1>Search Files</h1>

      <div className="card">
        {/* Query type selector */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {[
            { value: "tags", label: "By Tags + Count" },
            { value: "thumbnail", label: "By Thumbnail URL" },
            { value: "file", label: "By File" },
          ].map((opt) => (
            <button
              key={opt.value}
              className={`btn ${queryType === opt.value ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setQueryType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch}>
          {/* Query by Tags */}
          {queryType === "tags" && (
            <div>
              {tagFilters.map((filter, index) => (
                <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "end" }}>
                  <div style={{ flex: 2 }}>
                    <label>Species</label>
                    <select
                      value={filter.species}
                      onChange={(e) => updateTagFilter(index, "species", e.target.value)}
                    >
                      <option value="">Select species...</option>
                      {SPECIES_LIST.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Min Count</label>
                    <input
                      type="number"
                      min="1"
                      value={filter.count}
                      onChange={(e) => updateTagFilter(index, "count", e.target.value)}
                    />
                  </div>
                  {tagFilters.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => removeTagFilter(index)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={addTagFilter} style={{ marginTop: "0.5rem" }}>
                + Add Species Filter
              </button>
            </div>
          )}

          {/* Query by Thumbnail URL */}
          {queryType === "thumbnail" && (
            <div className="form-group">
              <label>Thumbnail URL</label>
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://ecolens-thumbnails-....s3.amazonaws.com/..."
              />
            </div>
          )}

          {/* Query by File */}
          {queryType === "file" && (
            <div className="form-group">
              <label>Upload a file to find matching tags</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSearchFile(e.target.files[0])}
              />
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          <button className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Results ({results.length})</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
            💡 Click on the thumbnail to view the full-size image/video in a new tab.
          </p>
          <div className="results-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
            {results.map((r, i) => (
              <div className="result-card" key={i} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", background: "var(--card-bg)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <a href={r.file_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", marginBottom: "0.8rem" }}>
                    <img
                      src={r.thumbnail_url || r.file_url}
                      alt={r.file_name || "result"}
                      style={{ maxWidth: "100%", maxHeight: "150px", objectFit: "contain", borderRadius: "4px" }}
                    />
                  </a>
                  <div className="info">
                    <div style={{ fontSize: "0.85rem", fontWeight: "bold", wordBreak: "break-all", marginBottom: "0.5rem" }}>
                      {r.file_name}
                    </div>
                    <div className="tags" style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {r.tags && Object.entries(r.tags).map(([species, count]) => (
                        <span className="tag" key={species} style={{ background: "var(--tag-bg, #e0e0e0)", padding: "0.2rem 0.4rem", borderRadius: "3px", fontSize: "0.75rem" }}>
                          {species}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleDelete(r.file_url)}
                  style={{ color: "var(--error)", marginTop: "1rem", alignSelf: "flex-end", width: "fit-content", padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
                >
                  🗑️ Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
