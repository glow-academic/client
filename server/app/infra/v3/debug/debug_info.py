import asyncio
import uuid
from dataclasses import dataclass
from typing import cast

import asyncpg  # type: ignore
from agents import RunContextWrapper, function_tool

from app.sql.types import (
    InfraDebugInsertDebugInfoSqlParams,
    InfraDebugInsertDebugInfoSqlRow,
)
from utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v3/infrastructure/debug/insert_debug_info_complete.sql"


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
        params = InfraDebugInsertDebugInfoSqlParams(
            run_id=run_id,
            content=content,
        )
        asyncio.create_task(
            execute_sql_typed(conn, SQL_PATH, params=params)
        )
    except Exception as e:
        print(f"Error saving debug info: {e}")
        return f"Error saving debug info: {e}"
    return "Saved debug info"
