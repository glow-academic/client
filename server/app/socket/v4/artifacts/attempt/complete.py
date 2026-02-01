"""Attempt simulation complete handler.

Listens to AI generation completion events and emits attempt-specific
completion updates to clients. Filters by artifact_type='attempt'.

Handles both message completion and grade completion:
- Message: Saves content to DB, emits attempt_complete
- Grade: Emits attempt_graded with grade data
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptCompleteEvent,
    AttemptGradedEvent,
)
from app.sql.types import (
    SaveAttemptMessageContentSqlParams,
    SaveAttemptMessageContentSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


# SQL paths
SQL_PATH_SAVE_MESSAGE = "app/sql/v4/queries/generate/attempt/save_attempt_message_content_complete.sql"


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_attempt_complete(data: dict[str, Any]) -> None:
    """Handle generate_*_complete events - filter by attempt artifact_type and emit attempt-specific event."""
    # Skip processing if in eval mode
    eval_mode = data.get("eval_mode", False)
    if eval_mode:
        return

    # Filter by artifact_type (early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "attempt":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    # Verify profile still connected
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    profile_id = uuid.UUID(profile_id_str)

    resource_type = data.get("resource_type")
    event_type = data.get("event_type")

    # Handle based on resource type
    if resource_type == "grade":
        # Grading completion
        await _handle_grade_complete(sid, data)
    elif resource_type in ("attempt", "voice"):
        # Message completion
        await _handle_message_complete(sid, data, profile_id)
    elif event_type in ("tool_call_complete", "tool_result"):
        # Tool call completion (hints, contents, etc.)
        await _handle_tool_complete(sid, data)


async def _handle_message_complete(
    sid: str, data: dict[str, Any], profile_id: uuid.UUID
) -> None:
    """Handle message generation completion."""
    message_id = data.get("message_id")
    chat_id = data.get("chat_id")
    run_id = data.get("run_id")
    final_content = data.get("content") or data.get("final_content")
    input_tokens = data.get("input_tokens", 0)
    output_tokens = data.get("output_tokens", 0)

    if not message_id or not final_content:
        # Text completion without content - likely just status update
        return

    try:
        # Save message content to database
        async with get_db_connection() as conn:
            save_params = SaveAttemptMessageContentSqlParams(
                p_message_id=uuid.UUID(message_id),
                p_content=final_content,
                p_run_id=uuid.UUID(run_id) if run_id else None,
                p_input_tokens=input_tokens,
                p_output_tokens=output_tokens,
            )

            await execute_sql_typed(conn, SQL_PATH_SAVE_MESSAGE, params=save_params)

        # Emit attempt_complete event
        event = AttemptCompleteEvent(
            artifact_type="attempt",
            group_id=data.get("group_id", ""),
            resource_type="attempt",
            run_id=run_id,
            success=True,
            message=f"Message generation completed",
            chat_id=chat_id,
            message_id=message_id,
            final_content=final_content,
            completed=True,
        )

        await sio.emit(
            "attempt_complete",
            event.model_dump(mode="json"),
            room=sid,
        )

        # Also emit to simulation room for multi-tab sync
        if chat_id:
            await sio.emit(
                "simulation_text_new_message",
                {
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "role": "assistant",
                    "content": final_content,
                    "completed": True,
                },
                room=f"simulation_{chat_id}",
            )

        logger.info(
            f"Attempt message complete - message_id={message_id}, chat_id={chat_id}"
        )

    except Exception as e:
        logger.exception(f"Failed to save attempt message: {str(e)}")
        await sio.emit(
            "attempt_error",
            {
                "artifact_type": "attempt",
                "chat_id": chat_id,
                "message_id": message_id,
                "success": False,
                "message": f"Failed to save message: {str(e)}",
            },
            room=sid,
        )


async def _handle_grade_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle grading completion."""
    attempt_id = data.get("attempt_id")
    chat_id = data.get("chat_id")
    grade_id = data.get("grade_id")
    simulation_id = data.get("metadata", {}).get("simulation_id")

    # Extract grade data from tool results
    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]

    score = tool_result.get("score")
    passed = tool_result.get("passed")
    feedback = tool_result.get("feedback")

    # Emit attempt_graded event
    event = AttemptGradedEvent(
        simulation_id=simulation_id or "",
        attempt_id=attempt_id or "",
        chat_id=chat_id,
        grade_id=grade_id,
        score=score,
        passed=passed,
        feedback=feedback,
    )

    await sio.emit(
        "attempt_graded",
        event.model_dump(mode="json"),
        room=sid,
    )

    logger.info(
        f"Attempt grading complete - attempt_id={attempt_id}, "
        f"score={score}, passed={passed}"
    )


async def _handle_tool_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle tool call completion (hints, contents, etc.)."""
    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]

    tool_name = data.get("tool_name")
    resource_id = tool_result.get("resource_id")

    if not resource_id:
        # Tool execution may have failed, check success flag
        tool_success = tool_result.get("success", True)
        if not tool_success:
            # Tool execution failed - model can retry
            return

    # Emit progress event with tool completion
    event = AttemptCompleteEvent(
        artifact_type="attempt",
        group_id=data.get("group_id", ""),
        resource_type=tool_name or "tool",
        run_id=data.get("run_id"),
        success=True,
        message=f"{tool_name} completed",
        chat_id=data.get("chat_id"),
        message_id=data.get("message_id"),
    )

    await sio.emit(
        "attempt_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/complete", response_model=dict[str, bool])
async def attempt_complete_api(request: AttemptCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt generation completed."""
    return {"success": True}
