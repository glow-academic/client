import uuid
from dataclasses import dataclass

from agents import RunContextWrapper, function_tool
from app.models import DebugInfo
from sqlmodel import Session


@dataclass
class DebugContext:
    session: Session
    model_run_id: uuid.UUID


@function_tool
def debug_info(ctx: RunContextWrapper[DebugContext], content: str) -> str:
    """
    Meta-prompting/debug tool for the assistant.

    Call this tool whenever you are blocked, confused, or uncertain about how to
    proceed with the user's request (e.g., ambiguous instructions, missing inputs,
    conflicting constraints, or external/API failures). Pass a short, clear note
    in `content` that describes:
    - what you were trying to do,
    - what is unclear or failing,
    - what you need to continue,
    - any assumptions you are considering.

    The note is saved to the current model run for human review and troubleshooting.
    It is safe to call multiple times. Do not include secrets or large payloads.
    This tool does not reply to the user; it only logs context and returns a
    confirmation string.
    """
    model_run_id = ctx.context.model_run_id
    session = ctx.context.session

    try:
        session.add(DebugInfo(
            model_run_id=model_run_id,
            content=content
        ))
        session.commit()
    except Exception as e:
        print(f"Error saving debug info: {e}")
        return f"Error saving debug info: {e}"
    return "Saved debug info"