"""Rubric completion handler - handles run/text completion, multi-agent coordination,
and special rubric standard_description tool.

Resource-level tool_call_complete/tool_result events are now handled by the shared
resource_complete.py handler. This module handles:
- text_complete: save assistant messages
- run_complete: coordinate multi-agent completion via generation_tracker
- rubric_end + standard_description tool: special rubric description generation
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.rubric.save import save_rubric_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.generation_tracker import (
    cleanup_generation,
    record_agent_complete,
)
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
    """Handle rubric generation run completion.

    Coordinates multi-agent completion via generation_tracker:
    1. Saves assistant message and token counts
    2. Records this agent's completion
    3. If all agents done: emits rubric_generation_complete
    4. Cleans up generation tracking
    """
    run_id = data.get("run_id")
    assistant_output = data.get("assistant_output") or ""
    input_tokens = data.get("input_text_tokens", 0)
    output_tokens = data.get("output_text_tokens", 0)
    group_id_str = data.get("group_id")

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

    # Multi-agent coordination via generation tracker
    tool_results = data.get("tool_results") or []
    is_complete, _all_tool_results = await record_agent_complete(run_id, tool_results)

    if is_complete:
        # All agents finished - auto-save rubric if save=True (default)
        rubric_id: str | None = None

        should_save = data.get("save", True)
        profile_id_str = await find_profile_by_socket(sid)
        if should_save and profile_id_str and group_id_str:
            try:
                profile_id = uuid.UUID(profile_id_str)
                group_id = uuid.UUID(group_id_str)

                # Build resource_actions from all_tool_results
                resource_actions: dict[str, Any] = {}
                for tr in _all_tool_results:
                    if isinstance(tr, dict):
                        rt = tr.get("resource_type")
                        rid = tr.get("resource_id")
                        rids = tr.get("resource_ids")
                        if rt and rid:
                            resource_actions[rt] = {"resource_id": rid}
                        elif rt and rids:
                            resource_actions[rt] = {"resource_ids": rids}

                async with get_db_connection() as conn:
                    saved_id = await save_rubric_internal(
                        conn=conn,
                        profile_id=profile_id,
                        group_id=group_id,
                        resource_actions=resource_actions,
                    )
                    if saved_id:
                        rubric_id = str(saved_id)
            except Exception as e:
                logger.exception(f"Failed to auto-save rubric: {str(e)}")

        # Emit rubric_generation_complete
        event = RubricGenerationCompleteEvent(
            artifact_type="rubric",
            group_id=group_id_str or "",
            resource_type="rubric",
            run_id=run_id,
            success=True,
            message="Rubric generation completed",
            rubric_id=rubric_id,
        )

        await sio.emit(
            "rubric_generation_complete",
            event.model_dump(mode="json"),
            room=sid,
        )

        await cleanup_generation(run_id)


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


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/rubric_generation_complete")
async def rubric_generation_complete_api(
    request: RubricGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Rubric generation completed."""
    return {"success": True}
