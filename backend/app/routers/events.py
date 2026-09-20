from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_leader
from app.db import supabase
from app.models.schemas import EventCreate, EventOut
from app.services.access import require_event_in_club

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
