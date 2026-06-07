import { useState } from "react";
import { SPECIES_LIST } from "../utils/species";
import {
  queryByTags,
  queryByThumbnail,
  queryByFile,
  deleteFile
} from "../services/api";
import Navbar from "../components/Navbar";
import "./SearchPage.css";

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
          if (Object.keys(tags).length === 0)
            throw new Error("Please add at least one species tag filter");
          data = (await queryByTags(tags)).results || [];
          break;
        }
        case "thumbnail": {
          if (!thumbnailUrl) throw new Error("Please enter a thumbnail URL");
          data = (await queryByThumbnail(thumbnailUrl)).results || [];
          break;
        }
        case "file": {
          if (!searchFile)
            throw new Error("Please select an image file to query");
          const formData = new FormData();
          formData.append("file", searchFile);
          data = (await queryByFile(formData)).results || [];
          break;
        }
        default:
          data = [];
      }
      setResults(data);
      if (data.length === 0) setError("No matching records found");
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(fileUrl) {
    if (!window.confirm("Delete this file from S3 and the database?")) return;
    try {
      await deleteFile(fileUrl);
      setResults((prev) => prev.filter((item) => item.file_url !== fileUrl));
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  }

  return (
    <div className="sp-page">
      <Navbar user={user} />

      <div className="sp-body">
        {/* ── Decorative koala — z-index 0, behind the card ── */}
        <img src="/images/koala_3.PNG" alt="" className="sp-deco-koala" />

        <h1 className="sp-title">Search Files</h1>

        {/* ── Search card ── */}
        <div className="sp-card">
          {/* Tabs */}
          <div className="sp-tabs">
            {[
              { value: "tags", label: "By Tags + Count" },
              { value: "thumbnail", label: "By Thumbnail URL" },
              { value: "file", label: "By File" }
            ].map((opt) => (
              <button
                key={opt.value}
                className={`sp-tab ${queryType === opt.value ? "sp-tab-active" : ""}`}
                onClick={() => setQueryType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearch} className="sp-form">
            {/* By Tags */}
            {queryType === "tags" && (
              <div className="sp-tag-filters">
                {tagFilters.map((filter, index) => (
                  <div key={index} className="sp-tag-row">
                    <div className="sp-field" style={{ flex: 2 }}>
                      <label>Species</label>
                      <select
                        value={filter.species}
                        onChange={(e) =>
                          updateTagFilter(index, "species", e.target.value)
                        }
                      >
                        <option value="">Select species...</option>
                        {SPECIES_LIST.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sp-field" style={{ flex: 1 }}>
                      <label>Min Count</label>
                      <input
                        type="number"
                        min="1"
                        value={filter.count}
                        onChange={(e) =>
                          updateTagFilter(index, "count", e.target.value)
                        }
                      />
                    </div>
                    {tagFilters.length > 1 && (
                      <button
                        type="button"
                        className="sp-btn-remove"
                        onClick={() => removeTagFilter(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="sp-btn-secondary"
                  onClick={addTagFilter}
                >
                  + Add Species Filter
                </button>
              </div>
            )}

            {/* By Thumbnail URL */}
            {queryType === "thumbnail" && (
              <div className="sp-field">
                <label>Thumbnail URL</label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://ecolens-thumbnails-....s3.amazonaws.com/..."
                />
              </div>
            )}

            {/* By File */}
            {queryType === "file" && (
              <div className="sp-field">
                <label>Upload a file to find matching tags</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSearchFile(e.target.files[0])}
                  className="sp-file-input"
                />
              </div>
            )}

            {error && <div className="sp-error">{error}</div>}

            <button
              className="sp-btn-primary"
              style={{ marginTop: "1.2rem" }}
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {/* ── Results ── */}
        {results.length > 0 && (
          <div className="sp-results">
            <h2 className="sp-results-title">Results ({results.length})</h2>
            <p className="sp-results-hint">
              Click a thumbnail to view full-size image/video.
            </p>
            <div className="sp-results-grid">
              {results.map((r, i) => (
                <div className="sp-result-card" key={i}>
                  <div>
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={r.thumbnail_url || r.file_url}
                        alt={r.file_name || "result"}
                        className="sp-thumb"
                      />
                    </a>
                    <div className="sp-filename">{r.file_name}</div>
                    <div className="sp-chip-row">
                      {r.tags &&
                        Object.entries(r.tags).map(([species, count]) => (
                          <span className="sp-chip" key={species}>
                            {species}: {count}
                          </span>
                        ))}
                    </div>
                  </div>
                  <button
                    className="sp-btn-delete"
                    onClick={() => handleDelete(r.file_url)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
