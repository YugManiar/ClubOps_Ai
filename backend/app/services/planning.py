"""POST /api/events/plan: free text -> strict JSON plan -> Supabase rows."""

from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.config import settings
from app.db import supabase
from app.services.agent_tools import _log_action
from app.services.gemini import GeminiError, generate_structured

TASK_COUNT = 15
MIN_TASKS = 5

SYSTEM_PROMPT = (
    "You are an event-operations planner for college clubs. Turn the user's "
    "request into an event plan: a concise event name, a short description, "
    f"and about {TASK_COUNT} actionable, non-overlapping tasks covering "
    "logistics, promotion, budget, and day-of execution. For each task, give "
    "due_days_before_event: how many days before the event it must be done "
    "(0 = on the day)."
)


class PlannedTask(BaseModel):
    title: str = Field(min_length=1)
    description: str
    priority: Literal["low", "medium", "high", "urgent"]
    due_days_before_event: int = Field(ge=0, le=90)


class EventPlan(BaseModel):
    """Also the Gemini response schema."""

    name: str = Field(min_length=1)
    description: str
    tasks: list[PlannedTask]


def plan_and_save_event(
    club_id: UUID, prompt: str, start_time: datetime | None, location: str | None
) -> dict:
    start = start_time or (datetime.now(timezone.utc) + timedelta(days=14))
    system = (
        f"{SYSTEM_PROMPT} Today is {datetime.now(timezone.utc):%Y-%m-%d}; the event starts "
        f"{start:%Y-%m-%d}. Do not put a year in the event name unless the user does."
    )
    plan = generate_structured(
        model=settings.gemini_plan_model, system=system, prompt=prompt, schema=EventPlan
    )
    if len(plan.tasks) < MIN_TASKS:
        raise GeminiError(f"Gemini returned only {len(plan.tasks)} tasks; try a more detailed prompt")

    # Two inserts, no transaction through PostgREST: delete the event if tasks fail.
    event = (
        supabase.table("events")
        .insert(
            {
                "club_id": str(club_id),
                "name": plan.name,
                "description": plan.description,
                "location": location,
                "start_time": start.isoformat(),
            }
        )
        .execute()
        .data[0]
    )
    try:
        rows = [
            {
                "event_id": event["id"],
                "title": t.title,
                "description": t.description,
                "priority": t.priority,
                "due_date": (start - timedelta(days=t.due_days_before_event)).isoformat(),
            }
            for t in plan.tasks
        ]
        tasks = supabase.table("tasks").insert(rows).execute().data
    except Exception:
        supabase.table("events").delete().eq("id", event["id"]).execute()
        raise

    _log_action(event["id"], "plan_event", {"prompt": prompt, "task_count": len(tasks)})
    return {"event": event, "tasks": tasks}
