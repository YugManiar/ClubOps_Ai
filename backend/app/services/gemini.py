"""Shared google-genai client + JSON-mode helper."""

import time
from functools import lru_cache
from typing import TypeVar

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import settings

T = TypeVar("T", bound=BaseModel)


class GeminiError(Exception):
    """Gemini call failed or returned something unusable. Maps to HTTP 502."""


@lru_cache
def get_client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def _retry(call, **kwargs):
    """Retry transient overload (429/503) with short backoff."""
    for attempt in range(3):
        try:
            return call(**kwargs)
        except genai_errors.APIError as e:
            if e.code not in (429, 503) or attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def generate_with_retry(**kwargs):
    return _retry(get_client().models.generate_content, **kwargs)


def embed_with_retry(**kwargs):
    return _retry(get_client().models.embed_content, **kwargs)


def generate_structured(*, model: str, system: str, prompt: str, schema: type[T]) -> T:
    """Force Gemini to return JSON matching `schema` and validate it."""
    try:
        response = generate_with_retry(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        if not response.text:
            raise GeminiError("Gemini returned an empty response")
        return schema.model_validate_json(response.text)
    except GeminiError:
        raise
    except ValidationError as e:
        raise GeminiError(f"Gemini returned invalid JSON for {schema.__name__}: {e}") from e
    except Exception as e:
        raise GeminiError(f"Gemini request failed: {e}") from e
