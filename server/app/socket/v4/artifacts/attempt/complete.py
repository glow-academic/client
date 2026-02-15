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

from app.infra.v4.websocket.attempt.run_store import remove_run_context
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio

SHOULD_PROCEED = True
from app.socket.v4.artifacts.attempt.types import (
    AttemptAssistantCompleteEvent,
    AttemptCompleteEvent,
    AttemptContentProgressEvent,
    AttemptGradedEvent,
    AttemptGradingProgressEvent,
    AttemptHintProgressEvent,
)
from app.sql.types import (
    CompleteAttemptGradeSqlParams,
    CompleteAttemptMessageSqlParams,
    CompleteAttemptMessageSqlRow,
    GetAttemptGradeCompletionContextSqlParams,
    GetAttemptGradeCompletionContextSqlRow,
    GetAttemptMessageCompletionContextSqlParams,
    GetAttemptMessageCompletionContextSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH_GET_MESSAGE_CONTEXT = "app/sql/v4/queries/generate/attempt/get_attempt_message_completion_context_complete.sql"
SQL_PATH_GET_GRADE_CONTEXT = "app/sql/v4/queries/generate/attempt/get_attempt_grade_completion_context_complete.sql"
SQL_PATH_COMPLETE_MESSAGE = (
    "app/sql/v4/queries/generate/attempt/complete_attempt_message_complete.sql"
)
SQL_PATH_COMPLETE_GRADE = (
    "app/sql/v4/queries/generate/attempt/complete_attempt_grade_complete.sql"
)


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_attempt_complete(data: dict[str, Any]) -> None:
    """Handle generate_*_complete events - filter by attempt artifact_type and emit attempt-specific event."""
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
    resource_type = data.get("resource_type")
    event_type = data.get("event_type")

    # Handle based on event type and resource type.
    # Tool completions are checked FIRST because they also carry
    # resource_type="attempt" but need different handling.
    if event_type in ("tool_call_complete", "tool_result"):
        # Tool call completion (hints, contents, etc.)
        await _handle_tool_complete(sid, data)
    elif resource_type == "grade":
        # Grading completion
        await _handle_grade_complete(sid, data)
    elif resource_type in ("attempt", "voice"):
        # Message completion (only processes run_complete events)
        await _handle_message_complete(sid, data)


async def _handle_message_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle message generation completion.

    Only processes the final run_complete event (not mid-loop text_complete).
    Content is already inserted by the create_content tool call — we only
    mark the message as completed and update token usage.
    """
    # Only process the final event, not mid-loop text_complete events
    event_type = data.get("event_type")
    if event_type != "run_complete":
        return

    run_id = data.get("run_id")
    final_content = (
        data.get("assistant_output")
        or data.get("content")
        or data.get("final_content")
        or data.get("text")
    )
    input_tokens = data.get("input_text_tokens", data.get("input_tokens", 0))
    output_tokens = data.get("output_text_tokens", data.get("output_tokens", 0))

    if not run_id or not final_content:
        # Text completion without content - likely just status update
        return

    try:
        run_uuid = uuid.UUID(run_id)
        async with get_db_connection() as conn:
            # Fetch message context via typed SQL
            context_row = cast(
                GetAttemptMessageCompletionContextSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_GET_MESSAGE_CONTEXT,
                    params=GetAttemptMessageCompletionContextSqlParams(
                        p_run_id=run_uuid
                    ),
                ),
            )
            if not context_row or not context_row.message_id:
                return

            message_id = context_row.message_id
            chat_id = context_row.chat_id

            # Mark message completed, update tokens, get persona_id
            complete_row = cast(
                CompleteAttemptMessageSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_COMPLETE_MESSAGE,
                    params=CompleteAttemptMessageSqlParams(
                        p_message_id=message_id,
                        p_run_id=run_uuid,
                        p_input_tokens=input_tokens,
                        p_output_tokens=output_tokens,
                    ),
                ),
            )

            persona_id = complete_row.persona_id if complete_row else None

        assistant_event = AttemptAssistantCompleteEvent(
            chat_id=str(chat_id),
            message_id=str(message_id),
            content=final_content,
            created_at=context_row.created_at.isoformat()
            if context_row.created_at
            else None,
            persona_id=persona_id,
        )
        await sio.emit(
            "attempt_assistant_complete",
            assistant_event.model_dump(mode="json"),
            room=sid,
        )

        # Emit attempt_complete event (terminal event — client clears sending state)
        event = AttemptCompleteEvent(
            artifact_type="attempt",
            chat_id=str(chat_id),
            group_id=data.get("group_id", ""),
            resource_type="attempt",
            run_id=run_id,
            success=True,
            message="Message generation completed",
            final_content=final_content,
            completed=True,
        )

        await sio.emit(
            "attempt_complete",
            event.model_dump(mode="json"),
            room=sid,
        )

        logger.info(f"Attempt message complete - run_id={run_id}")
        remove_run_context(run_id)

        # Refresh MVs so the new message is immediately visible
        try:
            async with get_db_connection() as conn:
                await conn.execute(
                    "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_messages"
                )
        except Exception as mv_err:
            logger.warning(f"MV refresh failed (non-fatal): {mv_err}")

    except Exception as e:
        logger.exception(f"Failed to save attempt message: {str(e)}")
        remove_run_context(run_id)
        await sio.emit(
            "attempt_error",
            {
                "artifact_type": "attempt",
                "success": False,
                "message": f"Failed to save message: {str(e)}",
            },
            room=sid,
        )


async def _handle_grade_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle grading completion."""
    run_id = data.get("run_id")
    if not run_id:
        return

    run_uuid = uuid.UUID(run_id)
    input_tokens = data.get("input_text_tokens", data.get("input_tokens", 0))
    output_tokens = data.get("output_text_tokens", data.get("output_tokens", 0))

    tool_results = data.get("tool_results") or []
    score = _extract_grade_score(tool_results)
    passed = _extract_grade_passed(tool_results)
    feedback = _extract_grade_feedback(tool_results)

    async with get_db_connection() as conn:
        # Fetch grade context via typed SQL
        context_row = cast(
            GetAttemptGradeCompletionContextSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH_GET_GRADE_CONTEXT,
                params=GetAttemptGradeCompletionContextSqlParams(p_run_id=run_uuid),
            ),
        )
        if not context_row or not context_row.grade_id:
            return

        grade_id = context_row.grade_id
        chat_id = context_row.chat_id
        attempt_id = context_row.attempt_id
        simulation_id = context_row.simulation_id

        # Update tokens and grade via typed SQL
        await execute_sql_typed(
            conn,
            SQL_PATH_COMPLETE_GRADE,
            params=CompleteAttemptGradeSqlParams(
                p_grade_id=grade_id,
                p_run_id=run_uuid,
                p_score=score,
                p_passed=passed,
                p_input_tokens=input_tokens,
                p_output_tokens=output_tokens,
            ),
        )

    # Emit attempt_graded event
    event = AttemptGradedEvent(
        simulation_id=str(simulation_id) if simulation_id else "",
        attempt_id=str(attempt_id) if attempt_id else "",
        chat_id=str(chat_id) if chat_id else None,
        grade_id=str(grade_id) if grade_id else None,
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

    # Auto-proceed: trigger next scenario after grading completes
    if SHOULD_PROCEED and attempt_id:
        await internal_sio.emit(
            "attempt_start",
            {
                "sid": sid,
                "attempt_id": str(attempt_id),
            },
        )


async def _handle_tool_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle tool call completion (hints, contents, etc.)."""
    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]

    entry_id = tool_result.get("entry_id")
    entry_type = tool_result.get("entry_type")
    arguments = data.get("arguments") or {}

    if not entry_id:
        # Tool execution may have failed, check success flag
        tool_success = tool_result.get("success", True)
        if not tool_success:
            # Tool execution failed - model can retry
            return
        return

    # create_content: emit content progress with persona_id
    if entry_type == "contents":
        run_id = data.get("run_id")
        if not run_id:
            return
        context = await _get_message_context_by_run_id(run_id)
        if not context:
            return
        content_text = arguments.get("content", "")
        persona_id = arguments.get("persona_id") or arguments.get("personas_id")
        content_event = AttemptContentProgressEvent(
            chat_id=context["chat_id"],
            message_id=context["message_id"],
            content_id=entry_id,
            content=content_text,
            persona_id=persona_id,
        )
        await sio.emit(
            "attempt_content_progress",
            content_event.model_dump(mode="json"),
            room=sid,
        )
        return

    # create_hint: emit hint completion only
    if entry_type == "hints":
        run_id = data.get("run_id")
        if not run_id:
            return
        context = await _get_message_context_by_run_id(run_id)
        if not context:
            return
        hint_text = arguments.get("hint")
        hints_payload = []
        if isinstance(hint_text, str) and hint_text:
            hints_payload.append({"id": entry_id, "hint": hint_text})
        hint_event = AttemptHintProgressEvent(
            chat_id=context["chat_id"],
            message_id=context["message_id"],
            type="complete",
            hints_count=len(hints_payload),
            hints=hints_payload,
        )
        await sio.emit(
            "attempt_hint_progress",
            hint_event.model_dump(mode="json"),
            room=sid,
        )
        return


async def _get_message_context_by_run_id(run_id: str) -> dict[str, str] | None:
    """Resolve chat/message identifiers for attempt message stream events."""
    try:
        run_uuid = uuid.UUID(run_id)
        async with get_db_connection() as conn:
            context_row = cast(
                GetAttemptMessageCompletionContextSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_GET_MESSAGE_CONTEXT,
                    params=GetAttemptMessageCompletionContextSqlParams(
                        p_run_id=run_uuid
                    ),
                ),
            )
            if not context_row or not context_row.message_id:
                return None
            return {
                "chat_id": str(context_row.chat_id),
                "message_id": str(context_row.message_id),
            }
    except Exception:
        return None


def _extract_grade_score(tool_results: list[dict[str, Any]]) -> int | None:
    for item in tool_results:
        result = item.get("result") or {}
        if not isinstance(result, dict):
            continue
        if isinstance(result.get("score"), int):
            return result["score"]
        if isinstance(result.get("total"), int):
            return result["total"]
    return None


def _extract_grade_passed(tool_results: list[dict[str, Any]]) -> bool | None:
    for item in tool_results:
        result = item.get("result") or {}
        if not isinstance(result, dict):
            continue
        if isinstance(result.get("passed"), bool):
            return result["passed"]
    return None


def _extract_grade_feedback(tool_results: list[dict[str, Any]]) -> str | None:
    for item in tool_results:
        result = item.get("result") or {}
        if not isinstance(result, dict):
            continue
        feedback = result.get("feedback")
        if isinstance(feedback, str) and feedback:
            return feedback
    return None


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/complete", response_model=dict[str, bool])
async def attempt_complete_api(request: AttemptCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt generation completed."""
    return {"success": True}


@server_router.post("/attempt/assistant_complete", response_model=dict[str, bool])
async def attempt_assistant_complete_api(
    request: AttemptAssistantCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Attempt assistant message completed."""
    return {"success": True}


@server_router.post("/attempt/content_progress", response_model=dict[str, bool])
async def attempt_content_progress_api(
    request: AttemptContentProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Attempt content created with persona info."""
    return {"success": True}


@server_router.post("/attempt/hint_progress", response_model=dict[str, bool])
async def attempt_hint_progress_api(
    request: AttemptHintProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Attempt hint generation progress."""
    return {"success": True}


@server_router.post("/attempt/grading_progress", response_model=dict[str, bool])
async def attempt_grading_progress_api(
    request: AttemptGradingProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Attempt grading progress update."""
    return {"success": True}
