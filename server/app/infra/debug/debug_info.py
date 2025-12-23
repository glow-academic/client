import asyncio
import uuid
from dataclasses import dataclass

import asyncpg  # type: ignore
from agents import RunContextWrapper, function_tool

from app.utils.sql_helper import load_sql


@dataclass
class DebugContext:
    conn: asyncpg.Connection
    run_id: uuid.UUID


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
    run_id = ctx.context.run_id
    conn = ctx.context.conn

    try:
        # Insert debug info asynchronously (fire-and-forget)
        sql = load_sql("sql/v3/model_runs/insert_debug_info.sql")
        asyncio.create_task(conn.execute(sql, run_id, content))
    except Exception as e:
        print(f"Error saving debug info: {e}")
        return f"Error saving debug info: {e}"
    return "Saved debug info"
