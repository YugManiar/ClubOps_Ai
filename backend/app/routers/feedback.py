from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import CurrentUser, require_leader
from app.db import supabase
from app.services.access import require_event_in_club
from app.services.feedback import submit_feedback
from app.services.gemini import GeminiError

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    """No author field on purpose: the author is always the caller (from their token)."""

    event_id: UUID
    subject_member_id: UUID | None = None  # member being rated; None = the event itself
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class FeedbackResponse(BaseModel):
    accepted: bool
    validated_comment: str | None
    message: str | None
    average_rating: float
    rating_count: int


@router.post("/submit", response_model=FeedbackResponse)
def submit(body: FeedbackRequest, user: CurrentUser = Depends(require_leader)):
    """Leaders only (members get 403). Gemini checks the comment before the score is written."""
    require_event_in_club(body.event_id, user.club_id)

    if body.subject_member_id:
        if body.subject_member_id == user.member_id:
            raise HTTPException(status_code=400, detail="You can't rate yourself.")
        subject = (
            supabase.table("members").select("id").eq("id", str(body.subject_member_id))
            .eq("club_id", str(user.club_id)).limit(1).execute().data
        )
        if not subject:
            raise HTTPException(status_code=404, detail="member not found")

    try:
        return submit_feedback(
            body.event_id, user.member_id, body.subject_member_id, body.rating, body.comment.strip()
        )
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.delete("/{feedback_id}")
def delete_feedback(feedback_id: UUID, user: CurrentUser = Depends(require_leader)):
    """Leaders only. A DB trigger recalculates the event / member averages."""
    row = (
        supabase.table("feedback").select("id, events!inner(club_id)").eq("id", str(feedback_id))
        .limit(1).execute().data
    )
    if not row or row[0]["events"]["club_id"] != str(user.club_id):
        raise HTTPException(status_code=404, detail="feedback not found")
    supabase.table("feedback").delete().eq("id", str(feedback_id)).execute()
    return {"deleted": True}
