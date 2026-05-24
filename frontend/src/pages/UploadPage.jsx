import { useState, useRef } from "react";
import axios from "axios";

const API_URL = ""; // TODO: fill in after API Gateway is created

function UploadPage({ user }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setResults([]);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        // TODO: replace with actual API call
        // const res = await axios.post(`${API_URL}/upload`, formData, {
        //   headers: { Authorization: `Bearer ${user.token}` }
        // });
        // setResults(prev => [...prev, res.data]);

        console.log(`Uploading: ${file.name} (${file.size} bytes)`);
      }
      setResults([{ message: "Upload simulation complete" }]);
      setFiles([]);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <h1>Upload Files</h1>

      <div className="card">
        <div
          className={`upload-zone ${dragActive ? "active" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <p>📁 Drag and drop images or videos here</p>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
            Supported: JPG, PNG, GIF, MP4, AVI, MOV
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </div>

        {files.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <h3>Selected Files ({files.length})</h3>
            <ul style={{ listStyle: "none", marginTop: "0.5rem" }}>
              {files.map((f, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0" }}>
                  <span>{f.name} ({(f.size / 1024).toFixed(1)} KB)</span>
                  <span style={{ color: "var(--error)", cursor: "pointer" }} onClick={() => removeFile(i)}>
                    Remove
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={uploading}
              style={{ marginTop: "1rem" }}
            >
              {uploading ? "Uploading..." : `Upload ${files.length} file(s)`}
            </button>
          </div>
        )}

        {error && <div className="error-msg">{error}</div>}

        {results.length > 0 && (
          <div className="success-msg" style={{ marginTop: "1rem" }}>
            Upload complete! Files will be automatically tagged by ML model.
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadPage;
