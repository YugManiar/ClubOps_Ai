from typing import Literal

from pydantic import BaseModel, Field

TASK_COUNT = 15


class PlanRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=5000)


class SubTask(BaseModel):
    title: str = Field(min_length=1)
    description: str
    priority: Literal["low", "medium", "high"]


class EventPlan(BaseModel):
    """Also used as the Gemini response schema."""

    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    tasks: list[SubTask] = Field(min_length=TASK_COUNT, max_length=TASK_COUNT)
