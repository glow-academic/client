"""Agent completion handler - handles run/text completion.

Resource-level tool_call_complete/tool_result events are now handled by the shared
resource_complete.py handler. This module handles:
- text_complete: save assistant messages
- run_complete: save assistant output and update token counts
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_agent_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete and generate_text_complete events - filter by agent artifact_type."""
    if data.get("artifact_type") != "agent":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    event_type = data.get("event_type")

    if event_type == "text_complete":
        await _handle_agent_text_complete(sid, data)
        return

    if event_type == "run_complete":
        await _handle_agent_run_complete(sid, data)
        return

    # tool_call_complete and tool_result events are now handled by
    # resource_complete.py (shared handler) - nothing to do here


async def _handle_agent_text_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle agent text generation completion - save assistant message."""
    run_id = data.get("run_id")
    final_content = data.get("text") or ""

    if not run_id or not final_content:
        return

    try:
        async with get_db_connection() as conn:
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
            await conn.fetchval(
                create_message_sql,
                uuid.UUID(run_id),
                "assistant",
                final_content,
                True,
                False,
            )
    except Exception as e:
        logger.exception(f"Failed to save agent text message: {str(e)}")


async def _handle_agent_run_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle agent generation run completion - save assistant output and update token counts."""
    run_id = data.get("run_id")
    assistant_output = data.get("assistant_output") or ""
    input_tokens = data.get("input_text_tokens", 0)
    output_tokens = data.get("output_text_tokens", 0)

    if not run_id:
        return

    try:
        async with get_db_connection() as conn:
            if assistant_output:
                existing = await conn.fetchval(
                    """
                    SELECT id FROM messages_entry
                    WHERE run_id = $1 AND role = 'assistant'::message_type
                    LIMIT 1
                    """,
                    uuid.UUID(run_id),
                )
                if not existing:
                    create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
                    await conn.fetchval(
                        create_message_sql,
                        uuid.UUID(run_id),
                        "assistant",
                        assistant_output,
                        True,
                        False,
                    )

            if input_tokens or output_tokens:
                await conn.execute(
                    """
                    UPDATE runs_entry
                    SET input_tokens = COALESCE($2, input_tokens),
                        output_tokens = COALESCE($3, output_tokens)
                    WHERE id = $1
                    """,
                    uuid.UUID(run_id),
                    input_tokens,
                    output_tokens,
                )
    except Exception as e:
        logger.exception(f"Failed to save agent run complete: {str(e)}")


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/agent_generation_complete")
async def agent_generation_complete_api(
    request: dict[str, Any],
) -> dict[str, bool]:
    """Server-to-client event: agent generation complete."""
    _ = request
    return {"ok": True}
