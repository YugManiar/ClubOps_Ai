"""
The only module allowed to mutate the DB on the AI's behalf.

Every function here:
  1. does exactly one relational write against Supabase,
  2. logs itself to agent_actions for the live demo feed,
  3. returns a small JSON-safe dict (this goes straight back to Gemini as a
     function_response, so keep it short and unambiguous).

TOOL_DECLARATIONS is handed to Gemini as-is. TOOL_IMPL maps declaration name
-> callable so gemini_client.py never has to know implementation details.
"""

from datetime import datetime, timezone
from typing import Any

from app.db import supabase


def _log_action(event_id: str | None, action_type: str, payload: dict[str, Any]) -> None:
    supabase.table("agent_actions").insert(
        {"event_id": event_id, "action_type": action_type, "payload": payload}
    ).execute()


def create_event(club_id: str, name: str, start_time: str,
                  description: str | None = None, location: str | None = None) -> dict:
    row = {
        "club_id": club_id,
        "name": name,
        "start_time": start_time,
        "description": description,
        "location": location,
    }
    res = supabase.table("events").insert(row).execute()
    event = res.data[0]
    _log_action(event["id"], "create_event", row)
    return {"created": True, "event_id": event["id"], "name": event["name"]}


def create_task(event_id: str, title: str, description: str | None = None,
                 assignee_email: str | None = None, priority: str = "medium",
                 due_date: str | None = None) -> dict:
    assignee_id = None
    if assignee_email:
        member = (
            supabase.table("members")
            .select("id")
            .eq("email", assignee_email)
            .limit(1)
            .execute()
        )
        if member.data:
            assignee_id = member.data[0]["id"]

    row = {
        "event_id": event_id,
        "title": title,
        "description": description,
        "assignee_id": assignee_id,
        "priority": priority,
        "due_date": due_date,
    }
    res = supabase.table("tasks").insert(row).execute()
    task = res.data[0]
    _log_action(event_id, "create_task", row)
    return {"created": True, "task_id": task["id"], "title": task["title"],
            "assigned": assignee_id is not None}


def update_task_status(task_id: str, status: str) -> dict:
    res = (
        supabase.table("tasks")
        .update({"status": status})
        .eq("id", task_id)
        .execute()
    )
    if not res.data:
        return {"updated": False, "error": "task not found"}
    task = res.data[0]
    _log_action(task["event_id"], "update_task_status", {"task_id": task_id, "status": status})
    return {"updated": True, "task_id": task_id, "status": status}


def assign_task(task_id: str, assignee_email: str) -> dict:
    member = (
        supabase.table("members")
        .select("id, full_name")
        .eq("email", assignee_email)
        .limit(1)
        .execute()
    )
    if not member.data:
        return {"updated": False, "error": f"no member with email {assignee_email}"}

    member_id = member.data[0]["id"]
    res = (
        supabase.table("tasks")
        .update({"assignee_id": member_id})
        .eq("id", task_id)
        .execute()
    )
    if not res.data:
        return {"updated": False, "error": "task not found"}
    task = res.data[0]
    _log_action(task["event_id"], "assign_task",
                {"task_id": task_id, "assignee_email": assignee_email})
    return {"updated": True, "task_id": task_id, "assignee": member.data[0]["full_name"]}


def list_members(club_id: str) -> dict:
    res = supabase.table("members").select("full_name, email, role").eq("club_id", club_id).execute()
    return {"members": res.data}


TOOL_IMPL = {
    "create_event": create_event,
    "create_task": create_task,
    "update_task_status": update_task_status,
    "assign_task": assign_task,
    "list_members": list_members,
}

TOOL_DECLARATIONS = [
    {
        "name": "create_event",
        "description": "Create a new club event.",
        "parameters": {
            "type": "object",
            "properties": {
                "club_id": {"type": "string", "description": "UUID of the club"},
                "name": {"type": "string"},
                "description": {"type": "string"},
                "location": {"type": "string"},
                "start_time": {"type": "string", "description": "ISO 8601 datetime"},
            },
            "required": ["club_id", "name", "start_time"],
        },
    },
    {
        "name": "create_task",
        "description": "Create a task under an event. If assignee_email is known, assigns immediately.",
        "parameters": {
            "type": "object",
            "properties": {
                "event_id": {"type": "string", "description": "UUID of the parent event"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "assignee_email": {"type": "string", "description": "Member email, if mentioned"},
                "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                "due_date": {"type": "string", "description": "ISO 8601 datetime, if mentioned"},
            },
            "required": ["event_id", "title"],
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
        "description": "List members of a club, e.g. to resolve a name mentioned in notes to an email.",
        "parameters": {
            "type": "object",
            "properties": {"club_id": {"type": "string"}},
            "required": ["club_id"],
        },
    },
]
