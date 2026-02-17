"""Test complete handler.

Handles test run completion events.
Also handles grade completion events from the grading LLM generation.
Emits test_run_complete and test_graded to clients.

After grading completes, emits test_invocation for auto-proceed.
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import (
    TestGradedEvent,
    TestRunCompleteEvent,
)
from app.sql.types import CompleteTestGradeSqlParams
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH_COMPLETE_GRADE = (
    "app/sql/v4/queries/generate/test/complete_test_grade_complete.sql"
)


@internal_sio.on("test_run_done")  # type: ignore
async def handle_test_run_complete(data: dict[str, Any]) -> None:
    """Handle test run completion.

    This handler:
    1. Emits test_run_complete to clients
    2. Fire-and-forget: triggers grading for the completed run
    """
    sid = data.get("sid")
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    run_id = data.get("run_id")

    if not invocation_id:
        return

    invocation_id_str = str(invocation_id)

    # Get run completion details from data
    current_run = data.get("current_run", 1)
    total_runs = data.get("total_runs", 1)
    original_run_resource_id = data.get("original_run_resource_id")
    tool_calls = data.get("tool_calls")

    # Calculate remaining runs
    remaining_runs = total_runs - current_run

    # Emit test_run_complete
    event = TestRunCompleteEvent(
        invocation_id=invocation_id_str,
        run_id=str(run_id) if run_id else None,
        original_run_resource_id=str(original_run_resource_id)
        if original_run_resource_id
        else None,
        tool_calls=tool_calls,
        current_run=current_run,
        total_runs=total_runs,
        remaining_runs=remaining_runs,
    )

    if sid:
        await sio.emit("test_run_complete", event.model_dump(mode="json"), room=sid)

    await sio.emit(
        "test_run_complete",
        event.model_dump(mode="json"),
        room=f"test_{invocation_id_str}",
    )

    # Fire-and-forget: trigger grading for the completed run
    test_id = data.get("test_id")
    if test_id and run_id and sid:
        await internal_sio.emit(
            "test_grade",
            {
                "sid": sid,
                "invocation_id": invocation_id_str,
                "test_id": str(test_id),
                "run_id": str(run_id),
            },
        )


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_test_grade_complete(data: dict[str, Any]) -> None:
    """Handle grade generation completion for test artifact.

    Fires when the grading LLM generation finishes. Extracts score/passed/feedback
    from tool results, updates the test_grade_entry, and emits test_graded.

    After grading, emits test_invocation for auto-proceed chain.
    """
    if data.get("artifact_type") != "test":
        return
    if data.get("resource_type") != "grade":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    # Verify profile still connected
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    grade_id = data.get("grade_id")
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    run_id = data.get("run_id")  # grade_run_id

    # Extract score/passed/feedback from tool_results
    tool_results = data.get("tool_results") or []
    score = _extract_grade_score(tool_results)
    passed = _extract_grade_passed(tool_results)
    feedback = _extract_grade_feedback(tool_results)

    try:
        input_tokens = data.get("input_text_tokens", data.get("input_tokens", 0))
        output_tokens = data.get("output_text_tokens", data.get("output_tokens", 0))

        async with get_db_connection() as conn:
            # Update grade + run tokens via typed SQL
            await execute_sql_typed(
                conn,
                SQL_PATH_COMPLETE_GRADE,
                params=CompleteTestGradeSqlParams(
                    p_grade_id=uuid.UUID(grade_id) if grade_id else uuid.UUID(int=0),
                    p_run_id=uuid.UUID(run_id) if run_id else uuid.UUID(int=0),
                    p_score=score,
                    p_passed=passed,
                    p_input_tokens=input_tokens if run_id else None,
                    p_output_tokens=output_tokens if run_id else None,
                ),
            )

        # Emit test_graded to client
        invocation_id_str = str(invocation_id) if invocation_id else ""
        event = TestGradedEvent(
            invocation_id=invocation_id_str,
            grade_id=str(grade_id) if grade_id else None,
            score=score,
            passed=passed,
            feedback=feedback,
        )
        if sid:
            await sio.emit("test_graded", event.model_dump(mode="json"), room=sid)
        if invocation_id:
            await sio.emit(
                "test_graded",
                event.model_dump(mode="json"),
                room=f"test_{invocation_id_str}",
            )

        logger.info(
            f"Test grading complete - invocation_id={invocation_id}, "
            f"grade_id={grade_id}, score={score}, passed={passed}"
        )

        # Auto-proceed: emit to invocation handler
        test_id = data.get("test_id")
        if test_id and invocation_id:
            await internal_sio.emit(
                "test_invocation",
                {
                    "sid": sid,
                    "test_id": str(test_id),
                    "invocation_id": invocation_id_str,
                },
            )

    except Exception as e:
        logger.exception(f"Failed to handle test grade completion: {str(e)}")


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


@server_router.post("/test/run_complete", response_model=dict[str, bool])
async def test_run_complete_api(request: TestRunCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: Single test run completed."""
    return {"success": True}
