from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_leader
from app.models.schemas import AgentCommandRequest, AgentCommandResponse
from app.services.access import require_event_in_club
from app.services.gemini import GeminiError
from app.services.gemini_client import run_agent

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/command", response_model=AgentCommandResponse)
def execute_command(payload: AgentCommandRequest, user: CurrentUser = Depends(require_leader)):
    """
    The core endpoint. Takes a free-text command or meeting notes, runs the
    Gemini function-calling loop, and returns every DB mutation it made.
    """
    require_event_in_club(payload.event_id, user.club_id)
    try:
        result = run_agent(prompt=payload.prompt, event_id=str(payload.event_id))
    except LookupError:
        raise HTTPException(status_code=404, detail="event not found")
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return AgentCommandResponse(**result)
