import React, { useState } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

export default function App() {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle"); // 'idle' | 'uploading' | 'success' | 'error'
  const [uploadMessage, setUploadMessage] = useState("");
  const [docInfo, setDocInfo] = useState(null); // { name, chunks }
  const [docId, setDocId] = useState(null);

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [chunks, setChunks] = useState([]);
  const [searchStatus, setSearchStatus] = useState("idle"); // 'idle' | 'searching' | 'success' | 'error'

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadStatus("idle");
      setUploadMessage("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("error");
      setUploadMessage("Please select a file first.");
      return;
    }

    setUploadStatus("uploading");
    setUploadMessage("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // Try parsing JSON error message from server
        let errorMsg = "Upload failed";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setUploadStatus("success");
      setUploadMessage("Upload completed successfully!");
      setDocId(data.docId);
      setDocInfo({
        name: file.name,
        chunks: data.chunks || 0,
      });
    } catch (err) {
      console.error(err);
      setUploadStatus("error");
      setUploadMessage(err.message || "Failed to upload and process document.");
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearchStatus("searching");
    setAnswer("");
    setChunks([]);
  
    try {
      const response = await fetch(`${BACKEND_URL}/api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, docId }),
      });
  
      if (!response.ok) {
        throw new Error("Search request failed");
      }
  
      const data = await response.json();
      setSearchStatus("success");
      setAnswer(data.answer);
      setChunks(data.chunks || []);
    } catch (err) {
      console.error(err);
      setSearchStatus("error");
      setAnswer("An error occurred while fetching the answer.");
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">D</div>
          <h1 className="logo-text">DocuQuery AI</h1>
        </div>
        <span className="badge">Gemini RAG Engine</span>
      </header>

      {/* Main Layout Grid */}
      <main className="app-grid">
        {/* Sidebar Panel */}
        <section className="glass-card upload-container">
          <h2 className="section-title">
            <span style={{ color: "var(--accent-blue)" }}>⚡</span> Document Source
          </h2>
          
          <label className={`dropzone ${uploadStatus === "uploading" ? "active" : ""}`}>
            <input
              type="file"
              accept=".pdf,.txt"
              className="file-input"
              onChange={handleFileChange}
              disabled={uploadStatus === "uploading"}
            />
            <div className="upload-icon">📥</div>
            <div className="upload-text-main">
              {file ? file.name : "Choose PDF or TXT file"}
            </div>
            <div className="upload-text-sub">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "Drag and drop or browse files"}
            </div>
          </label>

          <button
            onClick={handleUpload}
            disabled={!file || uploadStatus === "uploading"}
            className="submit-btn"
            style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
          >
            {uploadStatus === "uploading" ? (
              <>
                <div className="spinner" /> Processing...
              </>
            ) : (
              "Upload & Index"
            )}
          </button>

          {/* Status Message */}
          {uploadMessage && (
            <div
              className={uploadStatus === "success" ? "status-success" : "status-error"}
              style={{ textAlign: "center", marginTop: "0.5rem" }}
            >
              {uploadMessage}
            </div>
          )}

          {/* Document details when successful */}
          {docInfo && (
            <div className="doc-info">
              <div className="doc-info-row">
                <span className="doc-info-label">Active Document:</span>
                <span className="doc-info-value" title={docInfo.name}>
                  {docInfo.name}
                </span>
              </div>
              <div className="doc-info-row">
                <span className="doc-info-label">Vector Chunks:</span>
                <span className="doc-info-value" style={{ color: "var(--accent-blue)" }}>
                  {docInfo.chunks} vectors
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Content Chat Console Area */}
        <section className="glass-card chat-console">
          <h2 className="section-title">
            <span style={{ color: "var(--accent-purple)" }}>✨</span> Ask the Document
          </h2>

          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Ask anything about the uploaded document..."
              className="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={searchStatus === "searching"}
            />
            <button
              type="submit"
              disabled={!query.trim() || searchStatus === "searching"}
              className="submit-btn"
            >
              {searchStatus === "searching" ? (
                <div className="spinner" />
              ) : (
                "Search"
              )}
            </button>
          </form>

          {/* Answer display area */}
          <div className="answer-panel">
            {searchStatus === "idle" && (
              <div className="placeholder-view">
                <div className="placeholder-icon">🔮</div>
                <h3>Ask a Question</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  Type a question above and press Search to retrieve answers based on your uploaded document content.
                </p>
              </div>
            )}

            {searchStatus === "searching" && (
              <div className="loading-box">
                <div className="loading-line" />
                <div className="loading-line" />
                <div className="loading-line" />
              </div>
            )}

            {(searchStatus === "success" || searchStatus === "error") && answer && (
              <div className="answer-card">
                <div className="answer-header">
                  <span>💡</span> Response
                </div>
                <div className="answer-content">{answer}</div>

                {searchStatus === "success" && chunks && chunks.length > 0 && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <div className="answer-header" style={{ fontSize: "0.9rem", color: "var(--accent-purple)", marginBottom: "0.75rem" }}>
                      <span>📄</span> Matching Passages ({chunks.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {chunks.map((ch, idx) => (
                        <div 
                          key={idx} 
                          style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            borderRadius: "12px",
                            padding: "1rem",
                            fontSize: "0.9rem",
                            lineHeight: "1.5",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            <span>Chunk #{ch.index + 1}</span>
                            <span style={{ color: "var(--accent-blue)" }}>Match: {(ch.similarity * 100).toFixed(1)}%</span>
                          </div>
                          <div style={{ color: "var(--text-primary)" }}>{ch.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}