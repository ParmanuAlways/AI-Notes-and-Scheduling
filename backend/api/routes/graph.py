"""
Knowledge graph (Obsidian-style) — the whole corpus as nodes + labeled edges.

Nodes : documents, notes, events, tasks (owner-scoped).
Edges : reference-number thread ("same reference" / "same series"),
        source links ("source of", or "reply to" for reply tasks),
        accepted soft links ("linked").
Read-only, deterministic, no AI. Powers the /graph view.
"""

import logging
from collections import defaultdict

from fastapi import APIRouter, Depends
from api.db import get_db
from api.auth import current_user, CurrentUser
from api.routes.documents import _ref_series

router = APIRouter(tags=["Graph"])
log = logging.getLogger(__name__)

# When two nodes are connected by more than one relation, keep the strongest.
_PRIORITY = {"same reference": 6, "same series": 5, "reply to": 4,
             "source of": 3, "linked": 2, "similar": 1}


@router.get("/graph")
def graph(user: CurrentUser = Depends(current_user)):
    uid = user["id"]
    conn = get_db()
    cur = conn.cursor()
    nodes, ids = [], set()
    edges = {}

    def node(nid, kind, label, extra=None):
        if nid in ids:
            return
        ids.add(nid)
        nodes.append({"id": nid, "kind": kind, "label": label or nid, **(extra or {})})

    def edge(a, b, relation, directed):
        if a not in ids or b not in ids or a == b:
            return
        key = tuple(sorted([a, b]))
        prev = edges.get(key)
        if prev and _PRIORITY.get(prev["relation"], 0) >= _PRIORITY.get(relation, 0):
            return
        # keep the requested direction (a -> b) for arrowed relations
        edges[key] = {"source": a, "target": b, "relation": relation, "directed": directed}

    try:
        cur.execute("SELECT id, filename, ref_number, letter_status FROM documents "
                    "WHERE users_id = %s AND deleted_at IS NULL", (uid,))
        docs = cur.fetchall()
        for d in docs:
            node(f"document-{d['id']}", "document", d["filename"],
                 {"ref_number": d["ref_number"], "letter_status": d["letter_status"]})

        cur.execute("SELECT id, title FROM notes WHERE users_id = %s AND status = 'active'", (uid,))
        for n in cur.fetchall():
            node(f"note-{n['id']}", "note", n["title"] or f"Note {n['id']}")

        cur.execute("SELECT id, title, event_date FROM events "
                    "WHERE users_id = %s AND status <> 'trashed' AND deleted_at IS NULL", (uid,))
        for e in cur.fetchall():
            node(f"event-{e['id']}", "event", e["title"],
                 {"date": e["event_date"].isoformat() if e["event_date"] else None})

        cur.execute("SELECT id, title, status, is_reply_task FROM tasks "
                    "WHERE users_id = %s AND status <> 'trashed' AND deleted_at IS NULL", (uid,))
        reply_tasks = set()
        for t in cur.fetchall():
            node(f"task-{t['id']}", "task", t["title"], {"status": t["status"]})
            if t["is_reply_task"]:
                reply_tasks.add(t["id"])

        # ── reference-number thread ──
        by_ref, by_series = defaultdict(list), defaultdict(list)
        for d in docs:
            ref = (d["ref_number"] or "").strip()
            if ref:
                by_ref[ref].append(f"document-{d['id']}")
                s = _ref_series(ref)
                if s:
                    by_series[s].append(f"document-{d['id']}")
        for grp in by_ref.values():
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    edge(grp[i], grp[j], "same reference", False)
        for grp in by_series.values():
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    edge(grp[i], grp[j], "same series", False)

        # ── source links (letter → its events/tasks/notes) ──
        cur.execute("SELECT source_type, source_id, entity_type, entity_id "
                    "FROM linked_documents WHERE source_type IN ('document','audio')")
        for r in cur.fetchall():
            a = f"{r['source_type']}-{r['source_id']}"
            b = f"{r['entity_type']}-{r['entity_id']}"
            rel = "reply to" if (r["entity_type"] == "task" and r["entity_id"] in reply_tasks) else "source of"
            edge(a, b, rel, True)

        # ── accepted soft links ──
        cur.execute("SELECT a_kind, a_id, b_kind, b_id FROM soft_links WHERE status = 'accepted'")
        for r in cur.fetchall():
            edge(f"{r['a_kind']}-{r['a_id']}", f"{r['b_kind']}-{r['b_id']}", "linked", False)
    finally:
        cur.close()
        conn.close()

    return {"nodes": nodes, "edges": list(edges.values())}
