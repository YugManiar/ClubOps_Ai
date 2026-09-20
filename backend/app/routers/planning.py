"""
POST /api/events/plan -- asynchronous.

Planning is a single Gemini generation of ~15 tasks plus two inserts: tens of
seconds on a good day. Running that inside the request is a trap in two ways:

  1. Any proxy in front of this endpoint has a ceiling. Vercel drops a Route
     Handler at 10-60s depending on plan. The browser gives up, the backend
     keeps going, and the user is left with a phantom event they never saw --
     or hits "create" again and gets two.
  2. FastAPI runs sync `def` endpoints on an anyio threadpool. A long blocking
     call holds a worker for its whole duration, so enough concurrent plans
     stall every other request in the process, including /health.

So the request enqueues a plan_jobs row and returns 202 immediately; the work
runs in a background task and the client polls GET /api/events/plan/{job_id}.
"""

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import CurrentUser, require_leader
from app.db import supabase
from app.limits import limiter
from app.models.schemas import PlanJobOut
from app.services.gemini import GeminiError
from app.services.planning import plan_and_save_event

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/events", tags=["planning"])


class PlanRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=5000)
    start_time: datetime | None = None
    location: str | None = Field(default=None, max_length=200)


class PlanAccepted(BaseModel):
    job_id: UUID
    status: str = "pending"


@router.post("/plan", status_code=202, response_model=PlanAccepted)
@limiter.limit("5/minute;50/day")  # the most expensive call in the product
def plan_event(
    request: Request,  # required by slowapi
    body: PlanRequest,
    background: BackgroundTasks,
    user: CurrentUser = Depends(require_leader),
):
    """Leader only. Queues a plan and returns at once. The club comes from the
    token -- there is no club_id in the request body to disagree with it."""
    job = (
        supabase.table("plan_jobs")
        .insert(
            {
                "club_id": str(user.club_id),
                "member_id": str(user.member_id),
                "prompt": body.prompt,
            }
        )
        .execute()
        .data[0]
    )
    background.add_task(
        _run_plan, job["id"], str(user.club_id), body.prompt, body.start_time, body.location
    )
    return PlanAccepted(job_id=job["id"])


@router.get("/plan/{job_id}", response_model=PlanJobOut)
def plan_status(job_id: UUID, user: CurrentUser = Depends(require_leader)):
    """Poll a queued plan. Scoped to the caller's club: another tenant's job id
    is a 404, not a peek at their prompt."""
    rows = (
        supabase.table("plan_jobs")
        .select("id, status, event_id, error, created_at")
        .eq("id", str(job_id))
        .eq("club_id", str(user.club_id))
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="job not found")
    return rows[0]


def _set(job_id: str, **fields) -> None:
    supabase.table("plan_jobs").update(
        {**fields, "updated_at": datetime.now().astimezone().isoformat()}
    ).eq("id", job_id).execute()


def _run_plan(job_id, club_id, prompt, start_time, location) -> None:
    """Runs after the response has been sent. Never raises: a background task
    that throws has nobody to tell, so every outcome is written to the row.

    A process restart mid-plan leaves a row stuck in 'running'. Sweep those:
      update plan_jobs set status = 'failed', error = 'interrupted'
      where status in ('pending','running') and created_at < now() - interval '15 minutes';
    """
    _set(job_id, status="running")
    try:
        result = plan_and_save_event(UUID(club_id), prompt, start_time, location)
        _set(job_id, status="done", event_id=result["event"]["id"])
    except GeminiError as e:
        # Written for the model's own failures ("returned only 3 tasks..."),
        # which are actionable by the user.
        _set(job_id, status="failed", error=str(e)[:500])
    except Exception:  # noqa: BLE001 -- the row is the only error channel
        # Anything else (a PostgREST error carries column and constraint names)
        # goes to the log, not to the browser.
        log.exception("plan job %s failed", job_id)
        _set(job_id, status="failed", error="Planning failed. Please try again.")
