"""
The agent loop. This is the whole product: prompt in, tool calls out,
tool calls executed against Supabase, results fed back until Gemini
stops calling tools.

Not a chatbot -- if Gemini responds with text only and no function_call
on the first turn, that's treated as a no-op, not a "conversation."
"""

import google.generativeai as genai

from app.config import settings
from app.services.agent_tools import TOOL_DECLARATIONS, TOOL_IMPL

genai.configure(api_key=settings.gemini_api_key)

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


def run_agent(prompt: str, event_id: str) -> dict:
    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        tools=[{"function_declarations": TOOL_DECLARATIONS}],
        system_instruction=SYSTEM_INSTRUCTION,
    )
    chat = model.start_chat()
    response = chat.send_message(
        f"[current event_id: {event_id}]\n\n{prompt}"
    )

    actions_taken: list[dict] = []

    for _ in range(MAX_TOOL_TURNS):
        function_calls = [
            part.function_call
            for part in response.candidates[0].content.parts
            if part.function_call
        ]
        if not function_calls:
            break

        tool_response_parts = []
        for fc in function_calls:
            fn = TOOL_IMPL.get(fc.name)
            args = dict(fc.args)
            try:
                result = fn(**args) if fn else {"error": f"unknown tool '{fc.name}'"}
            except Exception as exc:  # hackathon: fail loud into the response, don't crash the request
                result = {"error": str(exc)}

            actions_taken.append({"tool": fc.name, "args": args, "result": result})
            tool_response_parts.append(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=fc.name, response={"result": result}
                    )
                )
            )

        response = chat.send_message(tool_response_parts)

    summary = "".join(
        part.text for part in response.candidates[0].content.parts if part.text
    ) or "Done."

    return {"summary": summary, "actions": actions_taken}
