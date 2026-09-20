from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.schemas import EventOut, TaskOut
from app.services.gemini import GeminiError
from app.services.planning import plan_and_save_event

router = APIRouter(prefix="/api/events", tags=["planning"])


class PlanRequest(BaseModel):
    club_id: UUID
    prompt: str = Field(min_length=3, max_length=5000)
    start_time: datetime | None = None
    location: str | None = Field(default=None, max_length=200)


class PlanResponse(BaseModel):
    event: EventOut
    tasks: list[TaskOut]


@router.post("/plan", response_model=PlanResponse)
def plan_event(body: PlanRequest):
    """Text prompt -> Gemini strict-JSON plan -> event + tasks saved to Supabase."""
    try:
        return plan_and_save_event(body.club_id, body.prompt, body.start_time, body.location)
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))
