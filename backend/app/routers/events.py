from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_leader
from app.db import supabase
from app.models.schemas import EventCreate, EventOut
from app.services.access import require_event_in_club
from app.services.agent_tools import _log_action

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(club_id: UUID, user: CurrentUser = Depends(require_leader)):
    if club_id != user.club_id:
        raise HTTPException(status_code=403, detail="That club isn't yours.")
    res = supabase.table("events").select("*").eq("club_id", str(club_id)).execute()
    return res.data


@router.get("/{event_id}")
def get_event(event_id: UUID, user: CurrentUser = Depends(require_leader)):
    event = require_event_in_club(event_id, user.club_id)
    tasks = supabase.table("tasks").select("*").eq("event_id", str(event_id)).execute()
    return {**event, "tasks": tasks.data}


@router.post("", response_model=EventOut)
def create_event_manual(payload: EventCreate, user: CurrentUser = Depends(require_leader)):
    if payload.club_id != user.club_id:
        raise HTTPException(status_code=403, detail="That club isn't yours.")
    row = payload.model_dump(mode="json")
    res = supabase.table("events").insert(row).execute()
    return res.data[0]


@router.post("/{event_id}/complete", response_model=EventOut)
def complete_event(event_id: UUID, user: CurrentUser = Depends(require_leader)):
    """Mark an event completed. Leader only.

    The "every task is done" rule is enforced HERE, not in the UI: the browser's
    view of the board can be stale (another leader or the agent may have moved a
    task since it loaded) and a client-side check is not a control. A refused
    request is a 409 whose message says exactly what is outstanding.

    Idempotent: completing an already-completed event returns it unchanged.
    """
    event = require_event_in_club(event_id, user.club_id)

    if event["status"] == "completed":
        return event
    if event["status"] == "cancelled":
        raise HTTPException(status_code=409, detail="A cancelled event can't be completed.")

    tasks = (
        supabase.table("tasks").select("status").eq("event_id", str(event_id)).execute().data
    )
    if not tasks:
        raise HTTPException(
            status_code=409,
            detail="This event has no tasks yet. Add or plan some tasks before completing it.",
        )
    remaining = sum(1 for t in tasks if t["status"] != "done")
    if remaining:
        raise HTTPException(
            status_code=409,
            detail=f"{remaining} of {len(tasks)} tasks aren't done yet.",
        )

    updated = (
        supabase.table("events")
        .update({"status": "completed"})
        .eq("id", str(event_id))
        .eq("club_id", str(user.club_id))  # belt and braces: the write is tenant-scoped too
        .execute()
        .data
    )
    if not updated:
        raise HTTPException(status_code=404, detail="event not found")

    _log_action(str(event_id), "complete_event", {"task_count": len(tasks)})
    return updated[0]
