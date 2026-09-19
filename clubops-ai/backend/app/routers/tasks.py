from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.db import supabase
from app.models.schemas import TaskOut, TaskStatusUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(event_id: UUID):
    res = supabase.table("tasks").select("*").eq("event_id", str(event_id)).execute()
    return res.data


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskStatusUpdate):
    res = (
        supabase.table("tasks")
        .update({"status": payload.status})
        .eq("id", str(task_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="task not found")
    return res.data[0]
