from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.feedback import submit_feedback
from app.services.gemini import GeminiError

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    event_id: UUID
    member_id: UUID | None = None
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class FeedbackResponse(BaseModel):
    accepted: bool
    validated_comment: str | None
    message: str | None
    average_rating: float
    rating_count: int


@router.post("/submit", response_model=FeedbackResponse)
def submit(body: FeedbackRequest):
    """Gemini checks the comment is constructive; only then is the score written."""
    try:
        return submit_feedback(body.event_id, body.member_id, body.rating, body.comment.strip())
    except LookupError:
        raise HTTPException(status_code=404, detail="event not found")
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))
