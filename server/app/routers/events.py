from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.gemini_service import PlanGenerationError, generate_event_plan
from app.schemas import EventPlan, PlanRequest

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("/plan", response_model=EventPlan)
async def plan_event(body: PlanRequest) -> EventPlan:
    try:
        return await run_in_threadpool(generate_event_plan, body.prompt)
    except PlanGenerationError as e:
        raise HTTPException(status_code=502, detail=str(e))
