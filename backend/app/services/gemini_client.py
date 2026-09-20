"""
The agent loop. This is the whole product: prompt in, tool calls out,
tool calls executed against Supabase, results fed back until Gemini
stops calling tools.

Not a chatbot -- if Gemini responds with text only and no function_call
on the first turn, that's treated as a no-op, not a "conversation."
"""

from google.genai import types

from app.config import settings
from app.db import supabase
from app.services.agent_tools import TOOL_DECLARATIONS, TOOL_IMPL
from app.services.gemini import GeminiError, generate_with_retry

SYSTEM_INSTRUCTION = (
    "You are ClubOps AI, an autonomous event-ops agent for a college club. "
    "You are given free-text commands or raw meeting notes. Your job is to "
    "extract every actionable item and execute it via tool calls -- creating "
    "tasks, assigning owners, updating statuses, or creating events. "
    "Never respond with plain text describing what should happen; call the "
    "tools. Meeting notes often contain multiple action items -- call "
    "create_task once per action item, not once for the whole note. If a "
    "person's name is mentioned but you don't have their email, call "
    "list_members first to resolve it. After acting, reply with a one or two "
    "sentence plain-language summary of what you did."
)

MAX_TOOL_TURNS = 5

_CONFIG = types.GenerateContentConfig(
    system_instruction=SYSTEM_INSTRUCTION,
    tools=[
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name=d["name"],
                    description=d["description"],
                    parameters_json_schema=d["parameters"],
                )
                for d in TOOL_DECLARATIONS
            ]
        )
    ],
    # We run the loop ourselves so every call is logged into the response.
    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
)


def run_agent(prompt: str, event_id: str) -> dict:
    event = supabase.table("events").select("club_id").eq("id", event_id).limit(1).execute()
    if not event.data:
        raise LookupError("event not found")
    club_id = event.data[0]["club_id"]

    contents = [
        types.Content(
            role="user",
            parts=[types.Part(text=f"[current event_id: {event_id}] [club_id: {club_id}]\n\n{prompt}")],
        )
    ]
    actions_taken: list[dict] = []

    try:
        for _ in range(MAX_TOOL_TURNS):
            response = generate_with_retry(
                model=settings.gemini_model, contents=contents, config=_CONFIG
            )
            calls = response.function_calls or []
            if not calls:
                break

            # Echo the model turn back verbatim (keeps thought signatures intact).
            contents.append(response.candidates[0].content)
            result_parts = []
            for fc in calls:
                fn = TOOL_IMPL.get(fc.name)
                args = dict(fc.args or {})
                try:
                    result = fn(**args) if fn else {"error": f"unknown tool '{fc.name}'"}
                except Exception as exc:  # fail loud into the response, don't crash the request
                    result = {"error": str(exc)}
                actions_taken.append({"tool": fc.name, "args": args, "result": result})
                result_parts.append(types.Part.from_function_response(name=fc.name, response={"result": result}))
            contents.append(types.Content(role="user", parts=result_parts))
    except Exception as e:
        raise GeminiError(f"Agent request failed: {e}") from e

    return {"summary": (response.text or "").strip() or "Done.", "actions": actions_taken}
