from fastapi import APIRouter, HTTPException

from app.models.schemas import AgentCommandRequest, AgentCommandResponse
from app.services.gemini import GeminiError
from app.services.gemini_client import run_agent

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/command", response_model=AgentCommandResponse)
def execute_command(payload: AgentCommandRequest):
    """
    The core endpoint. Takes a free-text command or meeting notes, runs the
    Gemini function-calling loop, and returns every DB mutation it made.
    """
    try:
        result = run_agent(prompt=payload.prompt, event_id=str(payload.event_id))
    except LookupError:
        raise HTTPException(status_code=404, detail="event not found")
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return AgentCommandResponse(**result)
