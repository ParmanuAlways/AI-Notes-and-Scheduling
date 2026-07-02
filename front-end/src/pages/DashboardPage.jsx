import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard, getAuditLog, checkServices } from "../services/api";
import { AttentionPanel } from "../components/NeedsAttention";

const QUICK_ACTIONS = [
  { label: "Upload document", icon: "📄", to: "/upload" },
  { label: "Voice note",      icon: "🎙", to: "/voice" },
  { label: "Ask AI",          icon: "💬", to: "/ask" },
  { label: "New event",       icon: "📅", to: "/calendar" },
  { label: "New task",        icon: "✓",  to: "/tasks" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(t) {
  return t ? t.slice(0, 5) : "";
}
function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── small building blocks (token-styled) ──────────────────────
function Stat({ n, label, onClick, tone }) {
  const color = tone === "hot" ? "var(--accent)" : tone === "warn" ? "var(--warn)" : "var(--text)";
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "22px 24px", cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 38, fontWeight: 680, letterSpacing: "-.5px", color }}>{n}</div>
      <div style={{ fontSize: 15, color: "var(--muted)", marginTop: 4 }}>{label}</div>
    </button>
  );
}

function Card({ title, count, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 2px 14px" }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 650 }}>{title}</h2>
        {count != null && <span style={{ fontSize: 14, color: "var(--muted)" }}>{count}</span>}
      </div>
      <div
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({ children, onClick, last }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
        borderBottom: last ? "none" : "1px solid var(--border)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dash, setDash] = useState(null);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState("");
  const [ai, setAi] = useState(null);

  useEffect(() => {
    getDashboard().then(setDash).catch((e) => setError(e.message));
    getAuditLog({ limit: 5 }).then(setAudit).catch(() => {});
    checkServices().then((s) => setAi(s?.ai_extraction === "ready")).catch(() => setAi(false));
  }, []);

  const todayEvents  = dash?.today_events         ?? [];
  const openTasks    = dash?.open_tasks            ?? [];
  const pendingConf  = dash?.pending_confirmations ?? [];
  const pendingReply = dash?.pending_replies       ?? [];
  const v = (arr) => (dash ? arr.length : "…");

  return (
    <div>
      {/* Greeting + AI status */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 680, margin: 0 }}>{greetingByHour()}</h1>
        <p style={{ color: "var(--muted)", fontSize: 15.5, margin: "6px 0 0" }}>
          {error ? `Could not load dashboard — ${error}` : "Here's what needs you today."}
        </p>
        {ai != null && (
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14,
              background: ai ? "var(--ok-soft)" : "var(--warn-soft)",
              color: ai ? "var(--ok)" : "var(--warn)",
              padding: "6px 14px", borderRadius: 99, fontSize: 13.5, fontWeight: 600,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} />
            {ai ? "AI extraction online" : "AI offline — manual entry still works (degraded mode)"}
          </div>
        )}
      </div>

      {/* Needs attention — overdue reconciliation + slipping items */}
      <AttentionPanel />

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 30 }}>
        <Stat n={v(todayEvents)}  label="Meetings today"        tone="hot"  onClick={() => navigate("/calendar")} />
        <Stat n={v(openTasks)}    label="Open tasks"                        onClick={() => navigate("/tasks")} />
        <Stat n={v(pendingConf)}  label="Awaiting confirmation"            onClick={() => navigate("/inbox")} />
        <Stat n={v(pendingReply)} label="Pending replies"       tone="warn" onClick={() => navigate("/tasks")} />
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 30 }}>
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            style={{
              display: "flex", alignItems: "center", gap: 10, background: "var(--surface)",
              border: "1px solid var(--border)", padding: "12px 18px", borderRadius: "var(--radius-sm)",
              cursor: "pointer", fontWeight: 600, fontSize: 15, color: "var(--text)", boxShadow: "var(--shadow)",
            }}
          >
            <span style={{ fontSize: 19 }}>{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>

      {/* Today's schedule */}
      <Card title="Today's schedule" count={`${todayEvents.length} event${todayEvents.length === 1 ? "" : "s"}`}>
        {todayEvents.length === 0 ? (
          <Row last><span style={{ color: "var(--muted)" }}>No events scheduled for today.</span></Row>
        ) : (
          todayEvents.map((ev, i) => (
            <Row key={ev.id} onClick={() => navigate("/calendar")} last={i === todayEvents.length - 1}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-2)", width: 72 }}>
                {fmtTime(ev.event_time) || "—"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16.5, fontWeight: 580 }}>{ev.title}</div>
                {ev.venue && <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 2 }}>{ev.venue}</div>}
              </div>
              <span
                style={{
                  marginLeft: "auto", fontSize: 13, fontWeight: 600, padding: "4px 12px", borderRadius: 99,
                  background: "var(--accent-soft)", color: "var(--accent)",
                }}
              >
                {ev.source === "manual" ? "Manual" : "Meeting"}
              </span>
            </Row>
          ))
        )}
      </Card>

      {/* Open tasks */}
      {openTasks.length > 0 && (
        <Card title="Open tasks" count={`showing ${Math.min(5, openTasks.length)} of ${openTasks.length}`}>
          {openTasks.slice(0, 5).map((t, i, arr) => (
            <Row key={t.id} onClick={() => navigate("/tasks")} last={i === arr.length - 1}>
              <span style={{ fontSize: 16.5, fontWeight: 550 }}>{t.title}</span>
              <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 14 }}>
                {t.due_date ? `Due ${fmtDate(t.due_date)}` : "No due date"}
              </span>
            </Row>
          ))}
        </Card>
      )}

      {/* Pending confirmations → Inbox */}
      {pendingConf.length > 0 && (
        <Card title="Awaiting your confirmation" count={`${pendingConf.length} document(s)`}>
          {pendingConf.map((item, i, arr) => (
            <Row key={item.job_id} onClick={() => navigate(`/confirm/${item.job_id}`)} last={i === arr.length - 1}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 580 }}>{item.filename}</div>
                <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>
                  Uploaded {fmtDate(item.uploaded_at)}
                  {item.extraction_count > 0 && ` · ${item.extraction_count} item(s) to confirm`}
                </div>
              </div>
              <span style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 600, fontSize: 15 }}>Review →</span>
            </Row>
          ))}
        </Card>
      )}

      {/* Recent activity */}
      <Card title="Recent activity">
        {audit.length === 0 ? (
          <Row last><span style={{ color: "var(--muted)" }}>No activity yet. Capture a document to get started.</span></Row>
        ) : (
          audit.map((entry, i, arr) => (
            <Row key={entry.id} last={i === arr.length - 1}>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{entry.action}</span>{" "}
                <span style={{ color: "var(--text-2)" }}>
                  {entry.entity_type} #{entry.entity_id}
                  {entry.detail ? ` — ${entry.detail}` : ""}
                </span>
              </div>
              <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>{fmtDate(entry.created_at)}</span>
            </Row>
          ))
        )}
      </Card>
    </div>
  );
}
