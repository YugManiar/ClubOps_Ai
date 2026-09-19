from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.db import supabase
from app.models.schemas import EventCreate, EventOut

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(club_id: UUID):
    res = supabase.table("events").select("*").eq("club_id", str(club_id)).execute()
    return res.data


@router.get("/{event_id}")
def get_event(event_id: UUID):
    event = supabase.table("events").select("*").eq("id", str(event_id)).limit(1).execute()
    if not event.data:
        raise HTTPException(status_code=404, detail="event not found")

    tasks = supabase.table("tasks").select("*").eq("event_id", str(event_id)).execute()
    return {**event.data[0], "tasks": tasks.data}


@router.post("", response_model=EventOut)
def create_event_manual(payload: EventCreate):
    row = payload.model_dump(mode="json")
    res = supabase.table("events").insert(row).execute()
    return res.data[0]
