from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, get_current_user
from app.db import supabase
from app.models.schemas import TaskOut, TaskStatusUpdate
from app.services.access import require_event_in_club

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(event_id: UUID, user: CurrentUser = Depends(get_current_user)):
    require_event_in_club(event_id, user.club_id)
    q = supabase.table("tasks").select("*").eq("event_id", str(event_id))
    if not user.is_leader:
        q = q.eq("assignee_id", str(user.member_id))  # members only ever see their own tasks
    return q.execute().data


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskStatusUpdate, user: CurrentUser = Depends(get_current_user)):
    rows = (
        supabase.table("tasks")
        .select("id, assignee_id, events!inner(club_id)")
        .eq("id", str(task_id))
        .limit(1)
        .execute()
        .data
    )
    # Unknown task, or one from another club: same 404 so ids can't be probed.
    if not rows or rows[0]["events"]["club_id"] != str(user.club_id):
        raise HTTPException(status_code=404, detail="task not found")
    if not user.is_leader and rows[0]["assignee_id"] != str(user.member_id):
        raise HTTPException(status_code=403, detail="You can only update tasks assigned to you.")

    res = supabase.table("tasks").update({"status": payload.status}).eq("id", str(task_id)).execute()
    return res.data[0]
