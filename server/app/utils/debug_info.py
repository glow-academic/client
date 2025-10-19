import asyncio
import uuid
from dataclasses import dataclass

import asyncpg  # type: ignore
from agents import RunContextWrapper, function_tool

from app.services.model_run_service import ModelRunService


@dataclass
class DebugContext:
    conn: asyncpg.Connection
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
    conn = ctx.context.conn

    try:
        # Create service and insert debug info asynchronously (fire-and-forget)
        service = ModelRunService(conn)
        asyncio.create_task(service.insert_debug_info(model_run_id, content))
    except Exception as e:
        print(f"Error saving debug info: {e}")
        return f"Error saving debug info: {e}"
    return "Saved debug info"
