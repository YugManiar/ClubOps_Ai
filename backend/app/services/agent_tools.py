"""
The only module allowed to mutate the DB on the AI's behalf.

SECURITY MODEL -- read before adding a tool.

The prompt fed to the agent is raw, attacker-controlled text ("paste your
meeting notes"). Anything the model can put in a function-call argument is
therefore attacker-controlled too. So the tenant is NOT a tool parameter: it is
bound per request from the verified JWT (see bind_tenant) and read from a
ContextVar here. Tools that touch an existing row re-check that the row belongs
to the bound club before writing.

Consequence: a tool must never accept club_id, event_id or any other tenant
identifier from Gemini. Adding one re-opens cross-tenant writes via prompt
injection.

Every function here:
  1. does exactly one relational write against Supabase,
  2. logs itself to agent_actions for the live demo feed,
  3. returns a small JSON-safe dict (this goes straight back to Gemini as a
     function_response, so keep it short and unambiguous).

TOOL_DECLARATIONS is handed to Gemini as-is. TOOL_IMPL maps declaration name
-> callable so gemini_client.py never has to know implementation details.
"""

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

from app.db import supabase

# Bound per request from the caller's verified token; never from the prompt.
_CLUB: ContextVar[str] = ContextVar("agent_club_id")
_EVENT: ContextVar[str] = ContextVar("agent_event_id")


@contextmanager
def bind_tenant(club_id: str, event_id: str):
    """Scope one agent run to a club + event. Both come from the JWT and a
    tenant-checked path parameter, so tools can trust them."""
    club_token, event_token = _CLUB.set(club_id), _EVENT.set(event_id)
    try:
        yield
    finally:
        _EVENT.reset(event_token)
        _CLUB.reset(club_token)


def _log_action(event_id: str | None, action_type: str, payload: dict[str, Any]) -> None:
    supabase.table("agent_actions").insert(
        {"event_id": event_id, "action_type": action_type, "payload": payload}
    ).execute()


def _task_in_club(task_id: str) -> dict | None:
    """A task is ours only if its parent event belongs to the bound club."""
    rows = (
        supabase.table("tasks")
        .select("id, event_id, events!inner(club_id)")
        .eq("id", task_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows or rows[0]["events"]["club_id"] != _CLUB.get():
        return None
    return rows[0]


def _resolve_member(email: str) -> str | None:
    """Email -> member id, within the bound club only. A member of another club
    resolves to None, exactly like an unknown address (no existence oracle)."""
    rows = (
        supabase.table("members")
        .select("id")
        .eq("email", email)
        .eq("club_id", _CLUB.get())
        .limit(1)
        .execute()
        .data
    )
    return rows[0]["id"] if rows else None


def create_event(name: str, start_time: str,
                 description: str | None = None, location: str | None = None) -> dict:
    row = {
        "club_id": _CLUB.get(),  # bound, not a parameter
        "name": name,
        "start_time": start_time,
        "description": description,
        "location": location,
    }
    event = supabase.table("events").insert(row).execute().data[0]
    _log_action(event["id"], "create_event", row)
    return {"created": True, "event_id": event["id"], "name": event["name"]}


def create_task(title: str, description: str | None = None,
                assignee_email: str | None = None, priority: str = "medium",
                due_date: str | None = None) -> dict:
    assignee_id = _resolve_member(assignee_email) if assignee_email else None
    event_id = _EVENT.get()  # bound, not a parameter
    row = {
        "event_id": event_id,
        "title": title,
        "description": description,
        "assignee_id": assignee_id,
        "priority": priority,
        "due_date": due_date,
    }
    task = supabase.table("tasks").insert(row).execute().data[0]
    _log_action(event_id, "create_task", row)
    return {"created": True, "task_id": task["id"], "title": task["title"],
            "assigned": assignee_id is not None}


def update_task_status(task_id: str, status: str) -> dict:
    task = _task_in_club(task_id)
    if not task:
        # Same message for "doesn't exist" and "belongs to another club": no probing.
        return {"updated": False, "error": "task not found"}
    supabase.table("tasks").update({"status": status}).eq("id", task_id).execute()
    _log_action(task["event_id"], "update_task_status", {"task_id": task_id, "status": status})
    return {"updated": True, "task_id": task_id, "status": status}


def assign_task(task_id: str, assignee_email: str) -> dict:
    task = _task_in_club(task_id)
    if not task:
        return {"updated": False, "error": "task not found"}
    member_id = _resolve_member(assignee_email)
    if not member_id:
        return {"updated": False, "error": f"no member with email {assignee_email} in this club"}
    supabase.table("tasks").update({"assignee_id": member_id}).eq("id", task_id).execute()
    _log_action(task["event_id"], "assign_task",
                {"task_id": task_id, "assignee_email": assignee_email})
    return {"updated": True, "task_id": task_id}


def list_members() -> dict:
    """No parameters on purpose: the club is bound, so this can only ever return
    the caller's own roster."""
    res = (
        supabase.table("members")
        .select("full_name, email, role")
        .eq("club_id", _CLUB.get())
        .execute()
    )
    return {"members": res.data}


TOOL_IMPL = {
    "create_event": create_event,
    "create_task": create_task,
    "update_task_status": update_task_status,
    "assign_task": assign_task,
    "list_members": list_members,
}

# No club_id / event_id anywhere below -- the model cannot express a tenant.
TOOL_DECLARATIONS = [
    {
        "name": "create_event",
        "description": "Create a new event for the current club.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "description": {"type": "string"},
                "location": {"type": "string"},
                "start_time": {"type": "string", "description": "ISO 8601 datetime"},
            },
            "required": ["name", "start_time"],
        },
    },
    {
        "name": "create_task",
        "description": (
            "Create a task under the event currently being worked on. "
            "If assignee_email is known, assigns immediately."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "assignee_email": {"type": "string", "description": "Member email, if mentioned"},
                "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                "due_date": {"type": "string", "description": "ISO 8601 datetime, if mentioned"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "update_task_status",
        "description": "Change a task's status.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string"},
                "status": {"type": "string", "enum": ["todo", "in_progress", "blocked", "done"]},
            },
            "required": ["task_id", "status"],
        },
    },
    {
        "name": "assign_task",
        "description": "Assign an existing task to a member by email.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string"},
                "assignee_email": {"type": "string"},
            },
            "required": ["task_id", "assignee_email"],
        },
    },
    {
        "name": "list_members",
        "description": (
            "List the current club's members, e.g. to resolve a name mentioned "
            "in notes to an email address. Takes no arguments."
        ),
        "parameters": {"type": "object", "properties": {}},
    },
]
