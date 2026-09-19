from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    club_id: UUID
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
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
    status: str


class AgentCommandRequest(BaseModel):
    event_id: UUID
    prompt: str


class AgentAction(BaseModel):
    tool: str
    args: dict[str, Any]
    result: dict[str, Any]


class AgentCommandResponse(BaseModel):
    summary: str
    actions: list[AgentAction]


class ChatRequest(BaseModel):
    query: str = Field(min_length=1)
    club_id: Optional[UUID] = None
    top_k: int = Field(default=5, ge=1, le=20)


class DocumentMatch(BaseModel):
    id: UUID
    source: str
    chunk_index: int
    content: str
    metadata: dict[str, Any] = {}
    similarity: float


class ChatResponse(BaseModel):
    query: str
    context: str
    matches: list[DocumentMatch]
