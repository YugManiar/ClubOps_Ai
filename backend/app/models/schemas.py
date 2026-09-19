from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


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
