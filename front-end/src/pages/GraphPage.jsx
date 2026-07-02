/*
 * Knowledge Graph — an Obsidian-style view of the whole workspace. Documents,
 * notes, events and tasks are nodes; reference-number matches, source links and
 * soft-links are labelled, arrowed edges. Self-contained force-directed layout
 * in SVG (no external libraries — fully air-gapped): a small cooling physics
 * simulation, with pan / zoom, node drag, hover-highlight and click-to-open.
 */
import { useEffect, useRef, useReducer, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getGraph, documentDownloadUrl } from "../services/api";

const KIND = {
  document: { color: "#D97757", icon: "📄", label: "Letter" },
  note:     { color: "#4F7A52", icon: "📝", label: "Note" },
  event:    { color: "#B4791F", icon: "📅", label: "Event" },
  task:     { color: "#5B7089", icon: "✓",  label: "Task" },
};
const REF_RELATIONS = new Set(["same reference", "same series"]);

const W = 1600, H = 1000;   // simulation coordinate space

export default function GraphPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [, rerender] = useReducer((x) => x + 1, 0);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState(null);
  const [sel, setSel] = useState(null);
  const [filters, setFilters] = useState({ document: true, note: true, event: true, task: true, refOnly: false, labels: true });

  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const alphaRef = useRef(0);
  const rafRef = useRef(0);
  const svgRef = useRef(null);
  const dragRef = useRef(null);   // { id } while dragging a node
  const panRef = useRef(null);    // { x, y } while panning

  useEffect(() => {
    getGraph()
      .then((g) => {
        // seed positions on a circle so the layout unfolds nicely
        const n = g.nodes.length || 1;
        nodesRef.current = g.nodes.map((nd, i) => ({
          ...nd,
          x: W / 2 + Math.cos((2 * Math.PI * i) / n) * 320 + (i % 7) * 3,
          y: H / 2 + Math.sin((2 * Math.PI * i) / n) * 320 + (i % 5) * 3,
          vx: 0, vy: 0,
        }));
        const byId = Object.fromEntries(nodesRef.current.map((x) => [x.id, x]));
        edgesRef.current = g.edges.filter((e) => byId[e.source] && byId[e.target]);
        setData(g);
        heat(1);
      })
      .catch((e) => setError(e.message));
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heat = useCallback((a) => {
    alphaRef.current = Math.max(alphaRef.current, a);
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tick() {
    const ns = nodesRef.current, es = edgesRef.current;
    const alpha = alphaRef.current;
    const REP = 9000, SPRING = 0.022, LEN = 200, GRAV = 0.008, DAMP = 0.85;

    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const f = REP / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    const byId = Object.fromEntries(ns.map((x) => [x.id, x]));
    for (const e of es) {
      const a = byId[e.source], b = byId[e.target];
      if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - LEN) * SPRING;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const a of ns) {
      a.vx += (W / 2 - a.x) * GRAV;
      a.vy += (H / 2 - a.y) * GRAV;
      if (dragRef.current && dragRef.current.id === a.id) continue;
      a.vx *= DAMP; a.vy *= DAMP;
      a.x += a.vx * alpha; a.y += a.vy * alpha;
    }
    alphaRef.current *= 0.98;
    rerender();
    if (alphaRef.current > 0.03) rafRef.current = requestAnimationFrame(tick);
    else rafRef.current = 0;
  }

  // ── pointer: node drag, background pan ──
  const toGraph = (clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    const sy = ((clientY - r.top) / r.height) * H;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
  };

  function onNodeDown(e, id) {
    e.stopPropagation();
    dragRef.current = { id };
    setSel(id);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  function onBgDown(e) {
    panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  function onMove(e) {
    if (dragRef.current) {
      const g = toGraph(e.clientX, e.clientY);
      const nd = nodesRef.current.find((n) => n.id === dragRef.current.id);
      if (nd) { nd.x = g.x; nd.y = g.y; nd.vx = 0; nd.vy = 0; }
      heat(0.4); rerender();
    } else if (panRef.current) {
      const r = svgRef.current.getBoundingClientRect();
      const dx = ((e.clientX - panRef.current.x) / r.width) * W;
      const dy = ((e.clientY - panRef.current.y) / r.height) * H;
      setView((v) => ({ ...v, x: panRef.current.vx + dx, y: panRef.current.vy + dy }));
    }
  }
  function onUp() {
    dragRef.current = null; panRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setView((v) => ({ ...v, k: Math.min(3, Math.max(0.3, v.k * factor)) }));
  }

  function openNode(nd) {
    const id = nd.id.split("-")[1];
    if (nd.kind === "document") window.open(documentDownloadUrl(id), "_blank");
    else if (nd.kind === "note") navigate("/notes");
    else if (nd.kind === "event") navigate("/calendar");
    else if (nd.kind === "task") navigate("/tasks");
  }

  if (error) return <div style={{ color: "var(--danger)" }}>Could not load the graph — {error}</div>;
  if (!data) return <div style={{ color: "var(--muted)" }}>Building your graph…</div>;

  // visible set per filters
  const showKind = (k) => filters[k];
  const nodes = nodesRef.current.filter((n) => showKind(n.kind));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = edgesRef.current.filter((e) =>
    nodeIds.has(e.source) && nodeIds.has(e.target) &&
    (!filters.refOnly || REF_RELATIONS.has(e.relation)));

  const active = hover || sel;
  const neighborIds = new Set();
  if (active) {
    neighborIds.add(active);
    for (const e of edges) {
      if (e.source === active) neighborIds.add(e.target);
      if (e.target === active) neighborIds.add(e.source);
    }
  }
  const dim = (id) => active && !neighborIds.has(id);
  const edgeActive = (e) => active && (e.source === active || e.target === active);

  const counts = data.nodes.reduce((a, n) => ((a[n.kind] = (a[n.kind] || 0) + 1), a), {});

  const cbStyle = (on, color) => ({
    display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13.5,
    padding: "5px 11px", borderRadius: 99, border: "1px solid var(--border-2)",
    background: on ? "var(--surface)" : "var(--bg)", color: on ? "var(--text)" : "var(--muted)",
    userSelect: "none",
  });

  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: 15.5, margin: "0 0 14px" }}>
        Every document, note, event and task and how they connect — reference numbers, source letters and links.
        Drag nodes, scroll to zoom, hover to highlight, click to open.
      </p>

      {/* controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {Object.entries(KIND).map(([k, m]) => (
          <label key={k} style={cbStyle(filters[k], m.color)} onClick={() => setFilters((f) => ({ ...f, [k]: !f[k] }))}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: m.color, display: "inline-block" }} />
            {m.label}s <span style={{ color: "var(--muted)" }}>{counts[k] || 0}</span>
          </label>
        ))}
        <label style={cbStyle(filters.refOnly)} onClick={() => setFilters((f) => ({ ...f, refOnly: !f.refOnly }))}>
          {filters.refOnly ? "☑" : "☐"} Reference links only
        </label>
        <label style={cbStyle(filters.labels)} onClick={() => setFilters((f) => ({ ...f, labels: !f.labels }))}>
          {filters.labels ? "☑" : "☐"} Labels
        </label>
        <button onClick={() => setView({ x: 0, y: 0, k: 1 })}
          style={{ marginLeft: "auto", ...cbStyle(true), cursor: "pointer" }}>Reset view</button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "70vh", display: "block", cursor: panRef.current ? "grabbing" : "grab", touchAction: "none" }}
          onPointerDown={onBgDown}
          onWheel={onWheel}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
            </marker>
          </defs>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {/* edges */}
            {edges.map((e, i) => {
              const a = byId[e.source], b = byId[e.target];
              if (!a || !b) return null;
              const on = edgeActive(e);
              const isRef = REF_RELATIONS.has(e.relation);
              const faded = active && !on;
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              return (
                <g key={i} opacity={faded ? 0.08 : 1}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={on ? "var(--accent)" : isRef ? "#c9a08e" : "var(--border-2)"}
                    strokeWidth={on ? 2.4 : isRef ? 1.8 : 1.3}
                    strokeDasharray={e.relation === "same series" ? "5 5" : "none"}
                    markerEnd={e.directed ? "url(#arrow)" : undefined} />
                  {on && (
                    <text x={mx} y={my - 4} textAnchor="middle" fontSize="11"
                      fill="var(--accent)" style={{ pointerEvents: "none" }}>
                      {e.relation}
                    </text>
                  )}
                </g>
              );
            })}
            {/* nodes */}
            {nodes.map((n) => {
              const m = KIND[n.kind];
              const r = n.id === active ? 15 : 11;
              return (
                <g key={n.id} opacity={dim(n.id) ? 0.18 : 1}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => onNodeDown(e, n.id)}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => { e.stopPropagation(); openNode(n); }}>
                  <circle cx={n.x} cy={n.y} r={r} fill={m.color}
                    stroke="var(--surface)" strokeWidth="2.5" />
                  {((filters.labels && nodes.length <= 60) || n.id === active || view.k > 1.1) && (
                    <text x={n.x} y={n.y + r + 13} textAnchor="middle" fontSize="12"
                      fill="var(--text)" stroke="var(--surface)" strokeWidth="3.5"
                      paintOrder="stroke" strokeLinejoin="round"
                      fontWeight={n.id === active ? 700 : 500}
                      style={{ pointerEvents: "none" }}>
                      {n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* legend for edge meaning */}
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
        <span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#c9a08e" strokeWidth="2"/></svg> same reference</span>
        <span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#c9a08e" strokeWidth="2" strokeDasharray="5 5"/></svg> same series</span>
        <span><svg width="26" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="var(--muted)" strokeWidth="1.6" markerEnd="url(#arrow)"/></svg> source of / reply to</span>
        {nodes.length === 0 && <span>No items yet — upload a letter or add a note to grow your graph.</span>}
      </div>
    </div>
  );
}
