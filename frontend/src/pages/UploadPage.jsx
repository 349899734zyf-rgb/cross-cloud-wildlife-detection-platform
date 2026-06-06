import { useState, useRef } from "react";
import { getUploadUrl, uploadFileToS3 } from "../services/api";
import Navbar from "../components/Navbar";
import "./UploadPage.css";

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
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
  }

  function handleFileSelect(e) {
    setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
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
      const uploadResults = [];
      for (const file of files) {
        const checksum = await calculateSHA256(file);
        const userId = user.userId || user.username || "unknown";
        const { upload_url, file_url } = await getUploadUrl(
          file.name,
          file.type,
          userId,
          checksum
        );
        await uploadFileToS3(upload_url, file);
        uploadResults.push({
          file_name: file.name,
          file_url,
          status: "success"
        });
      }
      setResults(uploadResults);
      setFiles([]);
    } catch (err) {
      setError(
        err.message || "Upload failed. A duplicate file may have been detected."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="up-page">
      <Navbar user={user} />

      <div className="up-body">
        {/* ── Decorative tree — behind card ── */}
        <img src="/images/big_tree.PNG" alt="" className="up-deco-tree" />

        <h1 className="up-title">Upload Files</h1>

        <div className="up-card">
          {/* Drop zone */}
          <div
            className={"up-zone" + (dragActive ? " up-zone-active" : "")}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <span className="up-zone-icon">📁</span>
            <p className="up-zone-text">Drag and drop images or videos here</p>
            <p className="up-zone-hint">
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

          {/* File list */}
          {files.length > 0 && (
            <div className="up-file-list">
              <h3 className="up-file-list-title">
                Selected Files ({files.length})
              </h3>
              <ul className="up-file-ul">
                {files.map((f, i) => (
                  <li key={i} className="up-file-item">
                    <span>
                      {f.name} ({(f.size / 1024).toFixed(1)} KB)
                    </span>
                    <span className="up-remove" onClick={() => removeFile(i)}>
                      Remove
                    </span>
                  </li>
                ))}
              </ul>
              <button
                className="up-btn-primary"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : `Upload ${files.length} file(s)`}
              </button>
            </div>
          )}

          {error && <div className="up-error">{error}</div>}

          {results.length > 0 && (
            <div className="up-success">
              <div className="up-success-title">Upload successful!</div>
              <ul className="up-success-ul">
                {results.map((r, i) => (
                  <li key={i}>✅ {r.file_name}</li>
                ))}
              </ul>
              <p className="up-success-note">
                Files will be automatically processed by the ML model in the
                background.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadPage;
