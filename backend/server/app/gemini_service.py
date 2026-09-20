from google import genai
from google.genai import types
from pydantic import ValidationError

from app.config import settings
from app.schemas import TASK_COUNT, EventPlan

SYSTEM_PROMPT = (
    "You are an event-operations planner for college clubs. Turn the user's "
    "request into an event plan: a concise title, a short description, and "
    f"exactly {TASK_COUNT} actionable, non-overlapping sub-tasks covering "
    "logistics, promotion, budget, and day-of execution."
)


class PlanGenerationError(Exception):
    pass


def generate_event_plan(prompt: str) -> EventPlan:
    if not settings.gemini_api_key:
        raise PlanGenerationError("GEMINI_API_KEY is not configured")

    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=EventPlan,
            ),
        )
        return EventPlan.model_validate_json(response.text)
    except ValidationError as e:
        raise PlanGenerationError(f"Gemini returned an invalid plan: {e}") from e
    except Exception as e:
        raise PlanGenerationError(f"Gemini request failed: {e}") from e
