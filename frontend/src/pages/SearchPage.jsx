import { useState } from "react";
import { SPECIES_LIST } from "../utils/species";
import axios from "axios";

const API_URL = ""; // TODO: fill in after API Gateway is created

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
      let response;

      switch (queryType) {
        case "tags": {
          // Build tags object: { "koala": 3, "wombat": 2 }
          const tags = {};
          tagFilters.forEach((f) => {
            if (f.species) tags[f.species] = parseInt(f.count) || 1;
          });
          // TODO: replace with actual API call
          // response = await axios.post(`${API_URL}/query/tags`, tags);
          console.log("Query by tags:", tags);
          setResults([]);
          break;
        }
        case "thumbnail": {
          // TODO: replace with actual API call
          // response = await axios.get(`${API_URL}/query/thumbnail?url=${encodeURIComponent(thumbnailUrl)}`);
          console.log("Query by thumbnail URL:", thumbnailUrl);
          setResults([]);
          break;
        }
        case "file": {
          if (!searchFile) {
            setError("Please select a file");
            break;
          }
          const formData = new FormData();
          formData.append("file", searchFile);
          // TODO: replace with actual API call
          // response = await axios.post(`${API_URL}/query/file`, formData);
          console.log("Query by file:", searchFile.name);
          setResults([]);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
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
        <div>
          <h2>Results ({results.length})</h2>
          <div className="results-grid">
            {results.map((r, i) => (
              <div className="result-card" key={i}>
                <img src={r.thumbnail_url} alt={r.file_name || "result"} />
                <div className="info">
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    {r.file_name}
                  </div>
                  <div className="tags">
                    {r.tags && Object.entries(r.tags).map(([species, count]) => (
                      <span className="tag" key={species}>
                        {species}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
