import { useEffect, useState } from "react";
import { getTasks, createTask, updateTask, deleteTask, parseCapture } from "../services/api";
import DateInput, { fmtDate, toApiDate } from "../components/DateInput";
import { useToast } from "../components/ToastProvider";

const CATEGORIES = ["General", "Meeting", "Reply", "Review", "Personal", "Restricted", "Confidential"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const PRIORITY_CHIP = {
  Low:      { bg: "var(--surface-2)", fg: "var(--muted)" },
  Medium:   { bg: "var(--accent-soft)", fg: "var(--accent)" },
  High:     { bg: "var(--warn-soft)", fg: "var(--warn)" },
  Critical: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};

const STATUS_STYLE = {
  open:    { background: "var(--accent-soft)", color: "var(--accent)" },
  done:    { background: "var(--ok-soft)", color: "var(--ok)" },
  trashed: { background: "var(--surface-2)", color: "var(--muted)" },
};

const card = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
};
const inputStyle = {
  width: "100%", padding: "11px 13px", borderRadius: 9, border: "1px solid var(--border-2)",
  fontSize: 15, boxSizing: "border-box", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit",
};
const labelStyle = { display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 5, fontWeight: 600 };

export default function TasksPage() {
  const [allTasks, setAllTasks] = useState([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", due_date: "", category: "General", priority: "Medium", recurrence: "", count: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [nl, setNl] = useState("");
  const [parsing, setParsing] = useState(false);
  const toast = useToast();

  function loadTasks() {
    setLoading(true);
    getTasks({}).then(setAllTasks).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { loadTasks(); }, []);

  async function handleCreate() {
    if (!form.title) { setMsg("Title is required."); return; }
    setSaving(true); setMsg("");
    try {
      const payload = {
        title: form.title, due_date: toApiDate(form.due_date),
        category: form.category, priority: form.priority,
      };
      if (form.recurrence) {
        payload.recurrence = form.recurrence;
        payload.count = Number(form.count) || 4;
      }
      const r = await createTask(payload);
      setMsg(r.created > 1 ? `Saved ${r.created} tasks.` : "Task saved.");
      setForm({ title: "", due_date: "", category: "General", priority: "Medium", recurrence: "", count: "" });
      setShowForm(false);
      loadTasks();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Natural-language quick capture: parse the line, then open the form prefilled
  // so the user confirms before saving.
  async function handleParse() {
    if (!nl.trim()) return;
    setParsing(true);
    try {
      const it = await parseCapture(nl.trim());
      setForm({
        title: it.title || nl.trim(),
        due_date: it.date || "",
        category: "General",
        priority: it.priority || "Medium",
        recurrence: "", count: "",
      });
      setShowForm(true);
      setNl("");
      toast.info("Parsed — review and save.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleMarkDone(id) {
    await updateTask(id, { status: "done" }).catch((e) => alert(e.message));
    loadTasks();
  }
  async function handleDelete(id) {
    if (!window.confirm("Move task to trash?")) return;
    await deleteTask(id).catch((e) => alert(e.message));
    loadTasks();
  }

  const counts = {
    open: allTasks.filter((t) => t.status === "open").length,
    done: allTasks.filter((t) => t.status === "done").length,
    all: allTasks.length,
  };
  const tasks = filter === "all" ? allTasks : allTasks.filter((t) => t.status === filter);
  const pendingReplies = allTasks.filter((t) => {
    if (t.status !== "open" || !t.is_reply_task || !t.due_date) return false;
    return (new Date(t.due_date) - new Date()) / (1000 * 60 * 60 * 24) <= 2;
  });

  const btn = (primary) => ({
    background: primary ? "var(--accent)" : "var(--surface)",
    color: primary ? "#fff" : "var(--text-2)",
    border: primary ? "none" : "1px solid var(--border-2)",
    padding: "10px 20px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 600, fontSize: 15,
  });

  return (
    <div style={{ maxWidth: 980 }}>
      <p style={{ color: "var(--muted)", fontSize: 15.5, margin: "0 0 20px" }}>
        Track pending work, deadlines and reply-by dates.
      </p>

      {/* Pending replies (FR-23) */}
      {pendingReplies.length > 0 && (
        <div style={{ ...card, borderColor: "var(--warn)", background: "var(--warn-soft)", padding: "16px 20px", marginBottom: 24 }}>
          <p style={{ margin: "0 0 10px", fontWeight: 700, color: "var(--warn)" }}>
            ⚠ Pending replies — {pendingReplies.length} due soon
          </p>
          {pendingReplies.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 14.5, color: "var(--text)" }}>
                {t.title} — due <strong>{fmtDate(t.due_date)}</strong>
              </span>
              <button onClick={() => handleMarkDone(t.id)} style={{ ...btn(true), padding: "6px 14px", fontSize: 13 }}>Mark done</button>
            </div>
          ))}
        </div>
      )}

      {/* Filter tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 24 }}>
        {[{ label: "Open", key: "open" }, { label: "Done", key: "done" }, { label: "All", key: "all" }].map(({ label, key }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                textAlign: "left", ...card, padding: 22, cursor: "pointer",
                background: active ? "var(--accent-soft)" : "var(--surface)",
                borderColor: active ? "var(--accent)" : "var(--border)",
              }}
            >
              <div style={{ fontSize: 14, color: active ? "var(--accent)" : "var(--muted)", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 34, fontWeight: 680, marginTop: 4, color: active ? "var(--accent)" : "var(--text)" }}>
                {loading ? "…" : counts[key]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Natural-language quick capture */}
      <div style={{ ...card, padding: 14, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 18 }}>⚡</span>
        <input
          value={nl}
          onChange={(e) => setNl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleParse()}
          placeholder='Quick add — e.g. "pay electricity bill next Tuesday, high priority"'
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={handleParse} disabled={parsing || !nl.trim()} style={btn(true)}>
          {parsing ? "Parsing…" : "Parse"}
        </button>
      </div>

      {/* Create task */}
      <div style={{ marginBottom: 22 }}>
        <button onClick={() => { setShowForm((v) => !v); setMsg(""); }} style={btn(true)}>+ New task</button>
        {showForm && (
          <div style={{ ...card, padding: 20, marginTop: 14 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17 }}>New task</h3>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input type="text" placeholder="Task title" value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} />
              </div>
              <DateInput label="Due date" value={form.due_date} onChange={(v) => setForm((f) => ({ ...f, due_date: v }))} />
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} style={inputStyle}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Repeat</label>
                <select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))} style={inputStyle}>
                  <option value="">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {form.recurrence && (
                <div>
                  <label style={labelStyle}># times</label>
                  <input type="number" min="1" max="60" value={form.count} placeholder="4"
                    onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))} style={inputStyle} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={handleCreate} disabled={saving} style={btn(true)}>{saving ? "Saving…" : "Save task"}</button>
              <button onClick={() => { setShowForm(false); setMsg(""); }} style={btn(false)}>Cancel</button>
              {msg && <span style={{ color: msg.startsWith("Error") ? "var(--danger)" : "var(--ok)", fontSize: 14 }}>{msg}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Task list */}
      <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>
        {filter === "all" ? "All tasks" : filter === "open" ? "Open tasks" : "Completed tasks"}
      </h2>
      <div style={{ ...card, overflow: "hidden" }}>
        {error && <div style={{ padding: 20, color: "var(--danger)" }}>{error}</div>}
        {loading && <div style={{ padding: 20, color: "var(--muted)" }}>Loading tasks…</div>}
        {!loading && tasks.length === 0 && <div style={{ padding: 20, color: "var(--muted)" }}>No tasks. Create one above.</div>}

        {tasks.map((task, i) => (
          <div
            key={task.id}
            style={{
              padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                margin: "0 0 5px", fontSize: 16.5,
                textDecoration: task.status === "done" ? "line-through" : "none",
                color: task.status === "done" ? "var(--muted)" : "var(--text)",
              }}>
                {task.title}
              </h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, alignItems: "center" }}>
                {task.priority && task.priority !== "Medium" && PRIORITY_CHIP[task.priority] && (
                  <span style={{ ...PRIORITY_CHIP[task.priority], padding: "2px 9px", borderRadius: 99, fontWeight: 700 }}>
                    {task.priority}
                  </span>
                )}
                {task.due_date && <span style={{ color: "var(--muted)" }}>Due {fmtDate(task.due_date)}</span>}
                {task.classification && (
                  <span style={{ background: "var(--surface-2)", color: "var(--text-2)", padding: "2px 9px", borderRadius: 99, fontWeight: 600 }}>
                    {task.classification}
                  </span>
                )}
                <span style={{ ...STATUS_STYLE[task.status], padding: "2px 9px", borderRadius: 99, fontWeight: 600 }}>{task.status}</span>
                {task.source && <span style={{ color: "var(--muted)" }}>via {task.source}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {task.status === "open" && (
                <button onClick={() => handleMarkDone(task.id)} style={{ ...btn(true), padding: "7px 14px", fontSize: 13 }}>Done</button>
              )}
              <button onClick={() => handleDelete(task.id)}
                style={{ ...btn(false), padding: "7px 14px", fontSize: 13, color: "var(--danger)", borderColor: "var(--danger)" }}>Trash</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
