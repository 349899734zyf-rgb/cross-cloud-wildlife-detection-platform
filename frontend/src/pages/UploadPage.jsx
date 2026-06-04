import { useState, useRef } from "react";
import { getUploadUrl, uploadFileToS3 } from "../services/api";

async function calculateSHA256(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
    setError("");
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setResults([]);

    const uploadResults = [];
    const userId = user.userId || user.username || "unknown";

    for (const file of files) {
      try {
        const checksum = await calculateSHA256(file);
        const { upload_url, file_url } = await getUploadUrl(
          file.name, file.type, userId, checksum
        );
        await uploadFileToS3(upload_url, file);
        uploadResults.push({ file_name: file.name, file_url, status: "success" });
      } catch (err) {
        if (err.status === 409 && err.existingFile) {
          uploadResults.push({
            file_name: file.name,
            file_url: err.existingFile,
            status: "duplicate"
          });
        } else {
          uploadResults.push({ file_name: file.name, status: "error", message: err.message });
        }
      }
    }

    setResults(uploadResults);
    setFiles([]);
    setUploading(false);
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
            Supported: JPG, JPEG, PNG, GIF, MP4, AVI, MOV, MKV
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
            <ul
              style={{ listStyle: "none", marginTop: "0.5rem", paddingLeft: 0 }}
            >
              {files.map((f, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.3rem 0"
                  }}
                >
                  <span>
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </span>
                  <span
                    style={{ color: "var(--error)", cursor: "pointer" }}
                    onClick={() => removeFile(i)}
                  >
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
          <div style={{ marginTop: "1rem" }}>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {results.map((r, i) => (
                <li key={i} style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                  {r.status === "success" && (
                    <span style={{ color: "var(--success, green)" }}>
                      ✅ <strong>{r.file_name}</strong> — uploaded successfully
                    </span>
                  )}
                  {r.status === "duplicate" && (
                    <span style={{ color: "#b07d00" }}>
                      ⚠️ <strong>{r.file_name}</strong> — already exists.{" "}
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                        View existing file
                      </a>
                    </span>
                  )}
                  {r.status === "error" && (
                    <span style={{ color: "var(--error)" }}>
                      ❌ <strong>{r.file_name}</strong> — {r.message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {results.some(r => r.status === "success") && (
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                Uploaded files will be automatically tagged by the ML model.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadPage;
