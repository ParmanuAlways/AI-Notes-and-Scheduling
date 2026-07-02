import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FiPlus, FiHome, FiInbox, FiCalendar, FiSearch,
  FiMic, FiMessageCircle, FiCheckSquare, FiFileText,
  FiClock, FiList, FiTrash2, FiActivity,
} from "react-icons/fi";
import { getPendingConfirmations } from "../services/api";

// Consolidated navigation: a single primary Capture action, the five surfaces a
// user thinks about daily, and everything else triaged under "More". Fully
// token-styled so it tracks light/dark.
const PRIMARY = [
  { name: "Today",    path: "/",         icon: <FiHome /> },
  { name: "Inbox",    path: "/inbox",    icon: <FiInbox />, badgeKey: "inbox" },
  { name: "Calendar", path: "/calendar", icon: <FiCalendar /> },
  { name: "Search",   path: "/search",   icon: <FiSearch /> },
];

const MORE = [
  { name: "Voice",     path: "/voice",    icon: <FiMic /> },
  { name: "Ask AI",    path: "/ask",      icon: <FiMessageCircle /> },
  { name: "Tasks",     path: "/tasks",    icon: <FiCheckSquare /> },
  { name: "Notes",     path: "/notes",    icon: <FiFileText /> },
  { name: "Timeline",  path: "/timeline", icon: <FiClock /> },
  { name: "Audit Log", path: "/audit",    icon: <FiList /> },
  { name: "Trash",     path: "/trash",    icon: <FiTrash2 /> },
  { name: "Status",    path: "/status",   icon: <FiActivity /> },
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

function Sidebar() {
  const location = useLocation();
  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

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

      {/* Primary capture action */}
      <Link
        to="/upload"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          background: "var(--accent)", color: "#fff", textDecoration: "none",
          padding: "14px 14px", borderRadius: "var(--radius-sm)",
          fontSize: 16.5, fontWeight: 650, marginBottom: 8,
        }}
      >
        <FiPlus size={20} /> Capture
      </Link>

      {/* Primary destinations */}
      {PRIMARY.map((item) => (
        <NavRow
          key={item.path}
          item={item}
          active={isActive(item.path)}
          badge={item.badgeKey ? badges[item.badgeKey] : 0}
        />
      ))}

      {/* More */}
      <div
        style={{
          fontSize: 12, fontWeight: 600, color: "var(--muted)",
          textTransform: "uppercase", letterSpacing: ".6px", padding: "14px 12px 4px",
        }}
      >
        More
      </div>
      {MORE.map((item) => (
        <NavRow key={item.path} item={item} active={isActive(item.path)} badge={0} />
      ))}
    </div>
  );
}

export default Sidebar;
