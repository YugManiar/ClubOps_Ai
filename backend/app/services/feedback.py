"""POST /api/feedback/submit: Gemini validates the comment before we write the score."""

from uuid import UUID

from pydantic import BaseModel

from app.config import settings
from app.db import supabase
from app.services.gemini import generate_structured

SYSTEM_PROMPT = (
    "You review feedback that club members leave about an event. Decide whether "
    "the comment is constructive: specific, honest, and about the event. Harsh "
    "but specific criticism IS constructive. Insults, spam, personal attacks, "
    "or content-free rants are NOT. If constructive, return the comment lightly "
    "cleaned up (fix typos, remove profanity, keep the meaning and every "
    "specific point) as validated_comment. If not, set is_constructive=false, "
    "leave validated_comment empty, and write a one-sentence, friendly message "
    "telling the author how to rewrite it."
)


class FeedbackVerdict(BaseModel):
    is_constructive: bool
    validated_comment: str
    message: str


def submit_feedback(event_id: UUID, member_id: UUID | None, rating: int, comment: str) -> dict:
    event = supabase.table("events").select("id").eq("id", str(event_id)).limit(1).execute()
    if not event.data:
        raise LookupError("event not found")

    verdict: FeedbackVerdict | None = None
    if comment:
        verdict = generate_structured(
            model=settings.gemini_feedback_model,
            system=SYSTEM_PROMPT,
            prompt=comment,
            schema=FeedbackVerdict,
        )
        if not verdict.is_constructive:
            return _result(event_id, accepted=False, validated=None, message=verdict.message)

    supabase.table("feedback").insert(
        {
            "event_id": str(event_id),
            "member_id": str(member_id) if member_id else None,
            "rating": rating,
            "raw_comment": comment or None,
            "validated_comment": verdict.validated_comment if verdict else None,
            "is_constructive": verdict.is_constructive if verdict else None,
        }
    ).execute()
    return _result(event_id, accepted=True, validated=verdict.validated_comment if verdict else None)


def _result(event_id: UUID, *, accepted: bool, validated: str | None, message: str | None = None) -> dict:
    # average_rating / rating_count are maintained by a DB trigger on feedback.
    ev = (
        supabase.table("events")
        .select("average_rating, rating_count")
        .eq("id", str(event_id))
        .single()
        .execute()
        .data
    )
    return {
        "accepted": accepted,
        "validated_comment": validated,
        "message": message,
        "average_rating": float(ev["average_rating"]),
        "rating_count": ev["rating_count"],
    }
