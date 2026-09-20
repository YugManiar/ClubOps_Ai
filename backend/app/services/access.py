"""Tenant checks: the backend uses the RLS-bypassing key, so scope every write to the caller's club."""

from uuid import UUID

from fastapi import HTTPException

from app.db import supabase


def require_event_in_club(event_id: UUID | str, club_id: UUID) -> dict:
    """Return the event row, or 404 if it doesn't exist / belongs to another club (don't leak which)."""
    rows = supabase.table("events").select("*").eq("id", str(event_id)).eq("club_id", str(club_id)).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="event not found")
    return rows[0]
