from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, get_current_user, require_leader
from app.db import supabase
from app.models.schemas import TaskCreate, TaskOut, TaskUpdate
from app.services.access import require_event_in_club

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _require_member_in_club(member_id: UUID, club_id: UUID) -> None:
    """A task can only be assigned to someone in the caller's own club. Another
    club's member id is a 404, the same as an unknown one, so ids can't be probed."""
    rows = (
        supabase.table("members")
        .select("id")
        .eq("id", str(member_id))
        .eq("club_id", str(club_id))
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="member not found")


@router.get("", response_model=list[TaskOut])
def list_tasks(event_id: UUID, user: CurrentUser = Depends(get_current_user)):
    require_event_in_club(event_id, user.club_id)
    q = supabase.table("tasks").select("*").eq("event_id", str(event_id))
    if not user.is_leader:
        q = q.eq("assignee_id", str(user.member_id))  # members only ever see their own tasks
    return q.execute().data


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, user: CurrentUser = Depends(require_leader)):
    """Leader only. Persists a manually created task; before this existed the
    board's "New task" only lived in browser state and vanished on reload."""
    require_event_in_club(payload.event_id, user.club_id)
    if payload.assignee_id:
        _require_member_in_club(payload.assignee_id, user.club_id)

    row = payload.model_dump(mode="json")
    return supabase.table("tasks").insert(row).execute().data[0]


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskUpdate, user: CurrentUser = Depends(get_current_user)):
    """Change a task's status, priority and/or assignee.

    Leaders can change all three. A member may only move the status of a task
    assigned to them: priority and assignee are the leader's call.
    """
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

    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Nothing to update.")
    # Only the assignee is nullable. An explicit null status/priority is a client bug.
    for field in ("status", "priority"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=422, detail=f"{field} can't be null.")

    if not user.is_leader:
        if set(changes) - {"status"}:
            raise HTTPException(
                status_code=403, detail="Only club leaders can change a task's priority or assignee."
            )
        if rows[0]["assignee_id"] != str(user.member_id):
            raise HTTPException(status_code=403, detail="You can only update tasks assigned to you.")

    if changes.get("assignee_id"):
        _require_member_in_club(UUID(changes["assignee_id"]), user.club_id)

    res = supabase.table("tasks").update(changes).eq("id", str(task_id)).execute()
    return res.data[0]
