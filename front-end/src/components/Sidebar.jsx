import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiPlus, FiHome, FiInbox, FiCalendar, FiSearch, FiShare2,
  FiMic, FiMessageCircle, FiCheckSquare, FiFileText,
  FiUploadCloud, FiTrash2, FiList, FiActivity, FiSettings, FiChevronDown,
} from "react-icons/fi";
import { getPendingConfirmations } from "../services/api";

// Consolidated navigation. Three distinct clusters instead of one flat list of
// 13: (1) a Capture action that reveals the ways to add something, (2) the
// surfaces a user works in every day, (3) the two exploration surfaces — and
// admin/utility pages tucked behind a gear at the bottom. Fully token-styled so
// it tracks light/dark. Timeline is intentionally absent: it lives inside Graph
// as a layout mode, and Calendar covers the day view.
const CAPTURE = [
  { name: "Upload document", path: "/upload", icon: <FiUploadCloud /> },
  { name: "Voice note",      path: "/voice",  icon: <FiMic /> },
  { name: "New task",        path: "/tasks",  icon: <FiCheckSquare /> },
  { name: "New event",       path: "/calendar", icon: <FiCalendar /> },
  { name: "New note",        path: "/notes",  icon: <FiFileText /> },
];

const DAILY = [
  { name: "Today",    path: "/",         icon: <FiHome /> },
  { name: "Inbox",    path: "/inbox",    icon: <FiInbox />, badgeKey: "inbox" },
  { name: "Calendar", path: "/calendar", icon: <FiCalendar /> },
  { name: "Tasks",    path: "/tasks",    icon: <FiCheckSquare /> },
  { name: "Notes",    path: "/notes",    icon: <FiFileText /> },
];

const EXPLORE = [
  { name: "Graph",  path: "/graph",  icon: <FiShare2 /> },
  { name: "Search", path: "/search", icon: <FiSearch /> },
  { name: "Ask AI", path: "/ask",    icon: <FiMessageCircle /> },
];

const UTILITY = [
  { name: "Trash",     path: "/trash",  icon: <FiTrash2 /> },
  { name: "Audit Log", path: "/audit",  icon: <FiList /> },
  { name: "Status",    path: "/status", icon: <FiActivity /> },
];

function NavRow({ item, active, badge }) {
  return (
    <Link
      to={item.path}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "12px 12px",
        borderRadius: "var(--radius-sm)",
        textDecoration: "none",
        fontSize: 16,
        fontWeight: active ? 650 : 500,
        color: active ? "var(--accent)" : "var(--text-2)",
        background: active ? "var(--accent-soft)" : "transparent",
        transition: "background .12s ease, color .12s ease",
      }}
    >
      <span style={{ fontSize: 19, display: "flex" }}>{item.icon}</span>
      {item.name}
      {badge > 0 && (
        <span
          style={{
            marginLeft: "auto",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            display: "grid",
            placeItems: "center",
            padding: "0 6px",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 12, fontWeight: 600, color: "var(--muted)",
        textTransform: "uppercase", letterSpacing: ".6px", padding: "14px 12px 4px",
      }}
    >
      {children}
    </div>
  );
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // Capture menu + utility drawer are both closable pop-open sections.
  const [captureOpen, setCaptureOpen] = useState(false);
  const [utilOpen, setUtilOpen] = useState(UTILITY.some((u) => isActive(u.path)));
  const captureRef = useRef(null);

  // Close the Capture menu on outside click or route change.
  useEffect(() => { setCaptureOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!captureOpen) return;
    const onDoc = (e) => { if (captureRef.current && !captureRef.current.contains(e.target)) setCaptureOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [captureOpen]);

  // Live Inbox badge — how many extractions are waiting to be confirmed.
  // Polls gently; silently shows nothing if the backend is unreachable (NFR-9).
  const [inboxCount, setInboxCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      getPendingConfirmations()
        .then((p) => { if (alive) setInboxCount(p.length); })
        .catch(() => {});
    tick();
    const id = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [location.pathname]);
  const badges = { inbox: inboxCount };

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "18px 14px",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 16px" }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 9, background: "var(--accent)",
            display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 15,
            flexShrink: 0,
          }}
        >
          N
        </div>
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: 16, fontWeight: 650, color: "var(--text)" }}>Notes &amp; Scheduling</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Private · on-prem AI</div>
        </div>
      </div>

      {/* Primary capture action — reveals the ways to add something */}
      <div ref={captureRef} style={{ position: "relative", marginBottom: 8 }}>
        <button
          onClick={() => setCaptureOpen((o) => !o)}
          aria-expanded={captureOpen}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%",
            background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
            padding: "14px 14px", borderRadius: "var(--radius-sm)",
            fontSize: 16.5, fontWeight: 650,
          }}
        >
          <FiPlus size={20} /> Capture
          <FiChevronDown size={17} style={{ transition: "transform .15s ease", transform: captureOpen ? "rotate(180deg)" : "none" }} />
        </button>
        {captureOpen && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow)", padding: 6,
              display: "flex", flexDirection: "column", gap: 2,
            }}
          >
            {CAPTURE.map((c) => (
              <button
                key={c.name}
                onClick={() => { setCaptureOpen(false); navigate(c.path); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                  background: "transparent", border: "none", cursor: "pointer",
                  padding: "10px 12px", borderRadius: "var(--radius-sm)",
                  fontSize: 15, fontWeight: 500, color: "var(--text-2)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 18, display: "flex", color: "var(--accent)" }}>{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Daily surfaces */}
      <SectionLabel>Daily</SectionLabel>
      {DAILY.map((item) => (
        <NavRow
          key={item.path}
          item={item}
          active={isActive(item.path)}
          badge={item.badgeKey ? badges[item.badgeKey] : 0}
        />
      ))}

      {/* Exploration surfaces */}
      <SectionLabel>Explore</SectionLabel>
      {EXPLORE.map((item) => (
        <NavRow key={item.path} item={item} active={isActive(item.path)} badge={0} />
      ))}

      {/* Utility drawer — admin pages, out of the daily path */}
      <div style={{ marginTop: "auto", paddingTop: 10 }}>
        <button
          onClick={() => setUtilOpen((o) => !o)}
          aria-expanded={utilOpen}
          style={{
            display: "flex", alignItems: "center", gap: 13, width: "100%",
            background: "transparent", border: "none", cursor: "pointer",
            padding: "12px 12px", borderRadius: "var(--radius-sm)",
            fontSize: 16, fontWeight: 500, color: "var(--text-2)",
          }}
        >
          <span style={{ fontSize: 19, display: "flex" }}><FiSettings /></span>
          Settings &amp; more
          <FiChevronDown size={17} style={{ marginLeft: "auto", transition: "transform .15s ease", transform: utilOpen ? "rotate(180deg)" : "none" }} />
        </button>
        {utilOpen && UTILITY.map((item) => (
          <div key={item.path} style={{ paddingLeft: 12 }}>
            <NavRow item={item} active={isActive(item.path)} badge={0} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
