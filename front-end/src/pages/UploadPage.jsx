import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  uploadFile,
  getDocuments,
  deleteDocument,
  getPendingConfirmations,
  documentDownloadUrl,
  getAuditLog,
  checkServices,
  reextractDocument,
} from "../services/api";
import { fmtDate, fmtDateTime } from "../components/DateInput";
import { useToast } from "../components/ToastProvider";

// Map a job/document status to a token-based chip colour.
function chip(status) {
  const ok = ["done", "ready_to_confirm", "awaiting_confirm"];
  const bad = ["failed"];
  if (ok.includes(status)) return { bg: "var(--ok-soft)", fg: "var(--ok)" };
  if (bad.includes(status)) return { bg: "var(--danger-soft)", fg: "var(--danger)" };
  return { bg: "var(--warn-soft)", fg: "var(--warn)" }; // queued / uploading / processing / duplicate
}

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
};

export default function UploadPage() {
  const toast = useToast();

  const [queue, setQueue] = useState([]); // [{ file, name, size, status, message }]
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [pending, setPending] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [history, setHistory] = useState(null);

  function loadData() {
    getDocuments().then(setDocuments).catch(() => {});
    getPendingConfirmations().then(setPending).catch(() => {});
    checkServices().then((s) => setAiStatus(s.ai_extraction)).catch(() => {});
  }
  useEffect(() => { loadData(); }, []);

  const inProgress = documents.filter(
    (d) => ["queued", "processing"].includes(d.status) ||
           ["waiting", "processing"].includes(d.queue_status)
  );

  useEffect(() => {
    if (inProgress.length === 0) return;
    const id = setInterval(loadData, 4000);
    return () => clearInterval(id);
  }, [inProgress.length]);

  function onFilesPicked(fileList) {
    const files = Array.from(fileList);
    if (files.length > 20) {
      toast.error("Maximum 20 files per batch.");
      return;
    }
    setQueue(files.map((f) => ({ file: f, name: f.name, size: f.size, status: "queued", message: "" })));
  }

  async function handleBatchUpload() {
    setUploading(true);
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === "done") continue;
      setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: "uploading" } : item)));
      try {
        const res = await uploadFile(queue[i].file);
        setQueue((q) => q.map((item, idx) =>
          idx === i ? { ...item, status: "done", message: `Job #${res.job_id}` } : item));
      } catch (e) {
        const dup = String(e.message).toLowerCase().includes("duplicate");
        setQueue((q) => q.map((item, idx) =>
          idx === i ? { ...item, status: dup ? "duplicate" : "failed", message: e.message } : item));
      }
    }
    setUploading(false);
    toast.success("Uploaded. Review what the AI found in your Inbox.");
    loadData();
  }

  async function handleDeleteDoc(id) {
    if (!window.confirm("Move document to trash? You can restore it later.")) return;
    try { await deleteDocument(id); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleReextract(id) {
    try {
      await reextractDocument(id);
      toast.info("Re-extraction started — watch the Inbox.");
      setTimeout(loadData, 1500);
    } catch (e) { toast.error(e.message); }
  }

  async function openHistory(doc) {
    try {
      const entries = await getAuditLog({ entity_type: "document", entity_id: doc.id });
      setHistory({ doc, entries });
    } catch (e) { toast.error(e.message); }
  }

  const doneCount = queue.filter((q) => q.status === "done").length;
  const reviewCount = pending.length + inProgress.length;

  const btn = (primary) => ({
    background: primary ? "var(--accent)" : "var(--surface)",
    color: primary ? "#fff" : "var(--text-2)",
    border: primary ? "none" : "1px solid var(--border-2)",
    padding: "10px 18px", borderRadius: "var(--radius-sm)",
    cursor: "pointer", fontWeight: 600, fontSize: 15,
  });

  return (
    <div style={{ maxWidth: 980 }}>
      <p style={{ color: "var(--muted)", fontSize: 15.5, margin: "0 0 18px" }}>
        Upload letters, notices and scanned mail. PDF, JPG, PNG, TIFF — max 50 MB each, up to 20 files.
      </p>

      {/* AI status + review banner */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
        {aiStatus != null && (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: aiStatus === "ready" ? "var(--ok-soft)" : "var(--warn-soft)",
              color: aiStatus === "ready" ? "var(--ok)" : "var(--warn)",
              padding: "8px 14px", borderRadius: 99, fontSize: 14, fontWeight: 600,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} />
            {aiStatus === "ready" ? "AI extraction is on" : aiStatus == null ? "Checking AI…" : "AI extraction is off"}
          </span>
        )}
        {reviewCount > 0 && (
          <Link
            to="/inbox"
            style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--accent-soft)", color: "var(--accent)", textDecoration: "none",
              padding: "8px 16px", borderRadius: 99, fontSize: 14, fontWeight: 700,
            }}
          >
            {pending.length > 0 ? `${pending.length} ready to confirm` : `${inProgress.length} processing`} · Open Inbox →
          </Link>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFilesPicked(e.dataTransfer.files); }}
        style={{
          ...cardStyle,
          border: "2px dashed var(--border-2)",
          padding: 44, textAlign: "center", marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Drag &amp; drop documents</h2>
        <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 15 }}>or choose one or many files</p>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.tiff"
          onChange={(e) => onFilesPicked(e.target.files)}
          style={{ color: "var(--text-2)" }}
        />
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <div style={{ ...cardStyle, padding: 20, marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>Upload queue — {doneCount}/{queue.length} done</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setQueue([])} disabled={uploading} style={btn(false)}>Clear</button>
              <button onClick={handleBatchUpload} disabled={uploading} style={btn(true)}>
                {uploading ? "Uploading…" : `Upload ${queue.length} file(s)`}
              </button>
            </div>
          </div>
          {queue.map((item, idx) => {
            const c = chip(item.status);
            return (
              <div
                key={idx}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                  background: "var(--bg)", border: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</span>
                  <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 10 }}>
                    {(item.size / 1024).toFixed(0)} KB{item.message ? ` · ${item.message}` : ""}
                  </span>
                </div>
                <span style={{ background: c.bg, color: c.fg, padding: "4px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600 }}>
                  {item.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Uploaded documents */}
      {documents.length > 0 && (
        <div>
          <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>Your documents</h2>
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            {documents.map((doc, i) => {
              const c = chip(doc.status);
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                    padding: "16px 20px",
                    borderBottom: i < documents.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 16 }}>{doc.filename}</strong>
                    <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "3px 0 0" }}>
                      {(doc.file_type || "").toUpperCase()} — uploaded {fmtDate(doc.uploaded_at)}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ background: c.bg, color: c.fg, padding: "4px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600 }}>
                      {doc.status}
                    </span>
                    <a href={documentDownloadUrl(doc.id)} target="_blank" rel="noreferrer" style={{ ...btn(false), padding: "6px 12px", fontSize: 13, textDecoration: "none" }}>Open</a>
                    <button onClick={() => handleReextract(doc.id)} disabled={aiStatus !== "ready"}
                      title={aiStatus === "ready" ? "Re-run AI extraction" : "AI offline"}
                      style={{ ...btn(false), padding: "6px 12px", fontSize: 13, opacity: aiStatus === "ready" ? 1 : 0.5, cursor: aiStatus === "ready" ? "pointer" : "not-allowed" }}>
                      Re-extract
                    </button>
                    <button onClick={() => openHistory(doc)} style={{ ...btn(false), padding: "6px 12px", fontSize: 13 }}>History</button>
                    <button onClick={() => handleDeleteDoc(doc.id)} style={{ ...btn(false), padding: "6px 12px", fontSize: 13, color: "var(--danger)", borderColor: "var(--danger)" }}>Trash</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History modal */}
      {history && (
        <div
          onClick={() => setHistory(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...cardStyle, padding: 26, width: "100%", maxWidth: 560, maxHeight: "80vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>History — {history.doc.filename}</h3>
              <button onClick={() => setHistory(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 22 }}>×</button>
            </div>
            {history.entries.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No history recorded.</p>
            ) : (
              history.entries.map((entry) => (
                <div key={entry.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <strong style={{ color: "var(--accent)" }}>{entry.action}</strong>
                  {entry.detail ? ` — ${entry.detail}` : ""}
                  <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12.5 }}>{fmtDateTime(entry.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
