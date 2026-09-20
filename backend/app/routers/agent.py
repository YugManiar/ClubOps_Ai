from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import CurrentUser, require_leader
from app.limits import limiter
from app.models.schemas import AgentCommandRequest, AgentCommandResponse
from app.services.access import require_event_in_club
from app.services.gemini import GeminiError
from app.services.gemini_client import run_agent

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/command", response_model=AgentCommandResponse)
@limiter.limit("10/minute;200/day")  # up to MAX_TOOL_TURNS Gemini calls each
def execute_command(
    request: Request,  # required by slowapi
    payload: AgentCommandRequest,
    user: CurrentUser = Depends(require_leader),
):
    """
    The core endpoint. Takes a free-text command or meeting notes, runs the
    Gemini function-calling loop, and returns every DB mutation it made.

    The prompt is untrusted. The club and event are taken from the caller's
    verified token and bound server-side, so no amount of prompt injection can
    redirect a tool call at another tenant.
    """
    require_event_in_club(payload.event_id, user.club_id)
    try:
        result = run_agent(
            prompt=payload.prompt,
            event_id=str(payload.event_id),
            club_id=str(user.club_id),
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="event not found")
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return AgentCommandResponse(**result)
