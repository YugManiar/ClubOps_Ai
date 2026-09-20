from datetime import datetime
from typing import Literal, Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    club_id: UUID
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    location: Optional[str] = Field(default=None, max_length=200)
    start_time: datetime
    end_time: Optional[datetime] = None


class EventOut(BaseModel):
    id: UUID
    club_id: UUID
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    average_rating: float = 0
    rating_count: int = 0
    created_at: datetime


class TaskOut(BaseModel):
    id: UUID
    event_id: UUID
    assignee_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    created_at: datetime


class TaskStatusUpdate(BaseModel):
    status: Literal["todo", "in_progress", "blocked", "done"]


class AgentCommandRequest(BaseModel):
    event_id: UUID
    # Bounded: this is untrusted text that becomes Gemini input.
    prompt: str = Field(min_length=1, max_length=10000)


class AgentAction(BaseModel):
    tool: str
    args: dict[str, Any]
    result: dict[str, Any]


class AgentCommandResponse(BaseModel):
    summary: str
    actions: list[AgentAction]
    #: Actions the agent attempted that did not succeed. The agent writes row by
    #: row with no transaction, so a partial run must be visible to the caller
    #: rather than hidden behind a summary the model wrote before it knew.
    failed: int = 0
    #: True when the loop hit MAX_TOOL_TURNS with work still outstanding.
    truncated: bool = False


class PlanJobOut(BaseModel):
    """A queued /api/events/plan run. See routers/planning.py for why planning
    is asynchronous."""

    id: UUID
    status: Literal["pending", "running", "done", "failed"]
    event_id: Optional[UUID] = None
    error: Optional[str] = None
    created_at: datetime
