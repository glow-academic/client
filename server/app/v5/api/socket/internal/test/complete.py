"""Internal handler for test grade completion.

Handles: generate_call_complete (filtered for artifact_type=test, resource_type=grade)
Extracts score/passed/feedback from tool results and emits test_grade_progress.
"""

import uuid
from typing import Any

from app.v5.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.v5.infra.globals import get_internal_sio
from app.v5.api.socket.internal.test.types import TestGradedData
from app.v5.sql.types import CompleteTestGradeSqlParams
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_COMPLETE_GRADE = (
    "app/v5/sql/queries/generate/test/complete_test_grade_complete.sql"
)


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_test_grade_complete(data: dict[str, Any]) -> None:
    """Handle grade generation completion for test artifact."""
    if data.get("artifact_type") != "test":
        return
    if data.get("resource_type") != "grade":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    grade_id = data.get("grade_id")
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    run_id = data.get("run_id")

    tool_results = data.get("tool_results") or []
    score = _extract_grade_score(tool_results)
    passed = _extract_grade_passed(tool_results)
    feedback = _extract_grade_feedback(tool_results)

    try:
        input_tokens = data.get("input_text_tokens", data.get("input_tokens", 0))
        output_tokens = data.get("output_text_tokens", data.get("output_tokens", 0))

        async with get_db_connection() as conn:
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

        invocation_id_str = str(invocation_id) if invocation_id else ""
        rooms = [sid, f"test_{invocation_id_str}"] if invocation_id_str else [sid]

        # Emit graded via internal bus
        await internal_sio.emit(
            "test_grade_progress",
            TestGradedData(
                sid=sid,
                rooms=rooms,
                invocation_id=invocation_id_str,
                grade_id=str(grade_id) if grade_id else None,
                score=score,
                passed=passed,
                feedback=feedback,
            ).model_dump(mode="json"),
        )

        logger.info(
            f"Test grading complete - invocation_id={invocation_id}, "
            f"grade_id={grade_id}, score={score}, passed={passed}"
        )

    except Exception as e:
        logger.exception(f"Failed to handle test grade completion: {e}")


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
