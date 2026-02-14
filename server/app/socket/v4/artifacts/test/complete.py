"""Test complete handler.

Handles test run completion events and optionally chains to next run.
Also handles grade completion events from the grading LLM generation.
Emits test_run_complete and test_graded to clients.
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.types import (
    TestAllCompleteEvent,
    TestGradedEvent,
    TestRunCompleteEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("test_run_done")  # type: ignore
async def handle_test_run_complete(data: dict[str, Any]) -> None:
    """Handle test run completion and optionally chain to next run.

    This handler:
    1. Emits test_run_complete to clients
    2. Fire-and-forget: triggers grading for the completed run
    3. If run_all flag is set and there are more pending runs, triggers next run
    4. If no more pending runs, emits test_all_complete
    """
    sid = data.get("sid")
    chat_id = data.get("chat_id")
    run_id = data.get("run_id")
    run_all = data.get("run_all", False)

    if not chat_id:
        return

    chat_id_str = str(chat_id)

    # Get run completion details from data
    current_run = data.get("current_run", 1)
    total_runs = data.get("total_runs", 1)
    original_run_resource_id = data.get("original_run_resource_id")
    tool_calls = data.get("tool_calls")

    # Calculate remaining runs
    remaining_runs = total_runs - current_run

    # Emit test_run_complete
    event = TestRunCompleteEvent(
        chat_id=chat_id_str,
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
        room=f"test_{chat_id_str}",
    )

    # Fire-and-forget: trigger grading for the completed run
    test_id = data.get("test_id")
    if test_id and run_id and sid:
        await internal_sio.emit(
            "test_grade",
            {
                "sid": sid,
                "chat_id": chat_id_str,
                "test_id": str(test_id),
                "run_id": str(run_id),
            },
        )

    # If run_all and there are more runs, trigger next
    if run_all and remaining_runs > 0:
        logger.info(
            f"Chaining to next run - chat_id={chat_id_str}, remaining={remaining_runs}"
        )
        await internal_sio.emit(
            "test_run",
            {
                "sid": sid,
                "chat_id": chat_id_str,
                "test_id": str(test_id) if test_id else chat_id_str,
                "run_all": True,
            },
        )
    elif run_all:
        # All runs complete
        all_complete_event = TestAllCompleteEvent(
            chat_id=chat_id_str,
            total_runs=total_runs,
            success=True,
        )
        if sid:
            await sio.emit(
                "test_all_complete",
                all_complete_event.model_dump(mode="json"),
                room=sid,
            )
        await sio.emit(
            "test_all_complete",
            all_complete_event.model_dump(mode="json"),
            room=f"test_{chat_id_str}",
        )
        logger.info(
            f"All test runs complete - chat_id={chat_id_str}, total={total_runs}"
        )


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_test_grade_complete(data: dict[str, Any]) -> None:
    """Handle grade generation completion for test artifact.

    Fires when the grading LLM generation finishes. Extracts score/passed/feedback
    from tool results, updates the benchmark_grades_entry, and emits test_graded.
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
    chat_id = data.get("chat_id")
    run_id = data.get("run_id")  # grade_run_id

    # Extract score/passed/feedback from tool_results
    tool_results = data.get("tool_results") or []
    score = _extract_grade_score(tool_results)
    passed = _extract_grade_passed(tool_results)
    feedback = _extract_grade_feedback(tool_results)

    try:
        async with get_db_connection() as conn:
            # Update grade entry
            if grade_id and (score is not None or passed is not None):
                await conn.execute(
                    """
                    UPDATE benchmark_grades_entry
                    SET score = COALESCE($2, score),
                        passed = COALESCE($3, passed),
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    uuid.UUID(grade_id),
                    score,
                    passed,
                )

            # Update run tokens
            if run_id:
                input_tokens = data.get(
                    "input_text_tokens", data.get("input_tokens", 0)
                )
                output_tokens = data.get(
                    "output_text_tokens", data.get("output_tokens", 0)
                )
                await conn.execute(
                    """
                    UPDATE runs_entry
                    SET input_tokens = COALESCE($2, input_tokens),
                        output_tokens = COALESCE($3, output_tokens),
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    uuid.UUID(run_id),
                    input_tokens,
                    output_tokens,
                )

        # Emit test_graded to client
        event = TestGradedEvent(
            chat_id=str(chat_id) if chat_id else "",
            grade_id=str(grade_id) if grade_id else None,
            score=score,
            passed=passed,
            feedback=feedback,
        )
        if sid:
            await sio.emit("test_graded", event.model_dump(mode="json"), room=sid)
        if chat_id:
            await sio.emit(
                "test_graded",
                event.model_dump(mode="json"),
                room=f"test_{str(chat_id)}",
            )

        logger.info(
            f"Test grading complete - chat_id={chat_id}, "
            f"grade_id={grade_id}, score={score}, passed={passed}"
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
