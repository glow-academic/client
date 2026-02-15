"""Rubric completion handler - handles run/text completion and special rubric logic.

Resource-level tool_call_complete/tool_result events are now handled by the shared
resource_complete.py handler. This module handles:
- text_complete: save assistant messages
- run_complete: save assistant output and update token counts
- rubric_end + standard_description tool: special rubric description generation
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.rubric.types import RubricGenerationCompleteEvent
from app.sql.types import (
    GetRubricToolCallResultsSqlParams,
    GetRubricToolCallResultsSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)
SQL_PATH_RUBRIC_TOOL_RESULTS = (
    "app/sql/v4/queries/rubric/get_rubric_tool_call_results_complete.sql"
)

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
@internal_sio.on("rubric_end")  # type: ignore
async def handle_rubric_complete(data: dict[str, Any]) -> None:
    """Handle rubric completion events - text/run completion and standard_description tool."""
    if data.get("artifact_type") != "rubric":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    event_type = data.get("event_type") or data.get("type", "")

    # Handle text completion - save assistant message
    if event_type == "text_complete":
        await _handle_rubric_text_complete(sid, data)
        return

    # Handle run complete - save assistant output + update tokens
    if event_type == "run_complete":
        await _handle_rubric_run_complete(sid, data)
        return

    # Handle special rubric standard_description tool
    if event_type in ("tool_call_complete", "tool_result"):
        tool_name = data.get("tool_name", "")
        if tool_name == "standard_description":
            await _handle_rubric_standard_description(sid, data)
            return

    # All other tool_call_complete/tool_result events are handled by
    # resource_complete.py (shared handler) - nothing to do here


async def _handle_rubric_text_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle rubric text generation completion - save assistant message."""
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
        logger.exception(f"Failed to save rubric text message: {str(e)}")


async def _handle_rubric_run_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle rubric generation run completion - save assistant output and update token counts."""
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
        logger.exception(f"Failed to save rubric run complete: {str(e)}")


async def _handle_rubric_standard_description(sid: str, data: dict[str, Any]) -> None:
    """Handle special rubric standard_description tool - fetch and emit descriptions."""
    run_id = data.get("run_id")
    resource_id = data.get("resource_id")

    if not run_id:
        return

    try:
        async with get_db_connection() as conn:
            params = GetRubricToolCallResultsSqlParams(run_id=uuid.UUID(run_id))
            result = cast(
                GetRubricToolCallResultsSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_RUBRIC_TOOL_RESULTS, params=params
                ),
            )

            if result and result.descriptions:
                descriptions_list = []
                if isinstance(result.descriptions, list):
                    descriptions_list = result.descriptions
                elif (
                    isinstance(result.descriptions, dict)
                    and "descriptions" in result.descriptions
                ):
                    descriptions_list = result.descriptions["descriptions"]

                formatted_descriptions = []
                for desc in descriptions_list:
                    if isinstance(desc, dict):
                        formatted_descriptions.append(
                            {
                                "standard_group_id": str(
                                    desc.get("standard_group_id", "")
                                ),
                                "standard_id": str(desc.get("standard_id", "")),
                                "description": str(desc.get("description", "")),
                            }
                        )

                await sio.emit(
                    "artifact_tool_call_complete",
                    {
                        "resource_type": "rubric",
                        "resource_id": resource_id,
                        "run_id": run_id,
                        "tool_name": "standard_description",
                        "tool_type": data.get("tool_type"),
                        "tool_call_id": data.get("tool_call_id"),
                        "call_id": data.get("call_id"),
                        "descriptions": formatted_descriptions,
                        "updated_count": len(formatted_descriptions),
                        "success": True,
                        "message": f"Generated {len(formatted_descriptions)} description(s)",
                        "trace_id": data.get("trace_id"),
                    },
                    room=sid,
                )
            else:
                await sio.emit(
                    "artifact_tool_call_complete",
                    {
                        "resource_type": "rubric",
                        "resource_id": resource_id,
                        "run_id": run_id,
                        "tool_name": "standard_description",
                        "descriptions": [],
                        "updated_count": 0,
                        "success": False,
                        "message": "No descriptions found in tool call results",
                        "trace_id": data.get("trace_id"),
                    },
                    room=sid,
                )
    except Exception as e:
        await sio.emit(
            "artifact_generation_error",
            {
                "artifact_type": "rubric",
                "resource_type": "rubric",
                "resource_id": resource_id,
                "group_id": data.get("group_id"),
                "success": False,
                "message": f"Failed to handle rubric completion: {str(e)}",
                "trace_id": data.get("trace_id"),
            },
            room=sid,
        )


@server_router.post("/rubric_generation_complete")
async def rubric_generation_complete_api(
    request: RubricGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: rubric generation complete."""
    return {"ok": True}
