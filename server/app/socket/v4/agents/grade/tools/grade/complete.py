"""Handler for grade_grade_complete - finalizes grade tool calls and creates feedback."""

import json
import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (
    CreateFeedbackSqlParams,
    CreateFeedbackSqlRow,
    FindStandardByGroupAndScoreSqlParams,
    FindStandardByGroupAndScoreSqlRow,
)

internal_sio = get_internal_sio()

server_router = APIRouter()


class GradeGradeCompletePayload(BaseModel):
    """Grade tool complete event."""

    sid: str
    chat_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class GradeGradeCompleteErrorPayload(BaseModel):
    """Error response for grade grade complete."""

    success: bool
    message: str


async def _grade_grade_complete_impl(
    sid: str,
    data: GradeGradeCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle grade_grade_complete - parses arguments and creates feedback."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        room = f"simulation_{chat_id_uuid}"

        async with get_db_connection() as conn:
            # Parse tool arguments to extract score and feedback
            try:
                final_args = json.loads(data.arguments_raw)
                score = final_args.get("score")
                feedback = final_args.get("feedback", "")
            except json.JSONDecodeError:
                # Try to parse from final_content if arguments_raw is invalid
                try:
                    final_args = json.loads(data.final_content)
                    score = final_args.get("score")
                    feedback = final_args.get("feedback", "")
                except (json.JSONDecodeError, TypeError):
                    await internal_sio.emit(
                        "grade_grade_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": "Failed to parse tool arguments",
                        },
                    )
                    return

            if score is None:
                await internal_sio.emit(
                    "grade_grade_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Missing score in tool arguments",
                    },
                )
                return

            # Get grade_id from the run by querying grades table directly
            grade_row = await conn.fetchrow(
                "SELECT id FROM grades WHERE run_id = $1 LIMIT 1",
                uuid.UUID(data.run_id),
            )

            if not grade_row:
                await internal_sio.emit(
                    "grade_grade_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to get grade_id from run",
                    },
                )
                return

            grade_id_uuid = grade_row["id"]

            # Get standard groups from the run context to find the matching standard group
            # We need to get the rubric_id first, then get standard groups
            run_row = await conn.fetchrow(
                """
                SELECT 
                    si.rubric_id,
                    sc.id as chat_id
                FROM runs r
                JOIN chats sc ON sc.id = (
                    SELECT chat_id FROM attempt_chats ac 
                    JOIN chat_groups cg ON cg.chat_id = ac.chat_id
                    JOIN groups g ON g.id = cg.group_id
                    WHERE g.trace_id = (
                        SELECT g2.trace_id FROM chat_groups cg2
                        JOIN groups g2 ON g2.id = cg2.group_id
                        JOIN runs r2 ON r2.id = $1
                        LIMIT 1
                    )
                    LIMIT 1
                )
                JOIN attempt_chats ac ON ac.chat_id = sc.id
                JOIN simulation_attempts sa ON sa.id = ac.attempt_id
                JOIN simulations si ON si.id = sa.simulation_id
                WHERE r.id = $1
                LIMIT 1
                """,
                uuid.UUID(data.run_id),
            )

            if not run_row or not run_row["rubric_id"]:
                await internal_sio.emit(
                    "grade_grade_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to get rubric_id from run",
                    },
                )
                return

            rubric_id_uuid = run_row["rubric_id"]

            # Extract standard group ID from tool name
            # Tool name is "grade_{safe_name}", we need to find the standard group
            # by matching the safe_name
            tool_safe_name = data.tool_name.replace("grade_", "", 1)
            standard_group_id_uuid = None

            # Get standard groups for this rubric
            standard_group_rows = await conn.fetch(
                """
                SELECT sg.id, sg.short_name
                FROM rubric_standard_groups rsg
                JOIN standard_groups sg ON sg.id = rsg.standard_group_id
                WHERE rsg.rubric_id = $1 AND rsg.active = true
                """,
                rubric_id_uuid,
            )

            for group_row in standard_group_rows:
                from utils.agents.create_safe_field_name import create_safe_field_name

                group_safe_name = create_safe_field_name(group_row["short_name"] or "")
                if group_safe_name == tool_safe_name:
                    standard_group_id_uuid = group_row["id"]
                    break

            if not standard_group_id_uuid:
                await internal_sio.emit(
                    "grade_grade_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to find standard group for tool {data.tool_name}",
                    },
                )
                return

            # Find the standard that matches the score for this standard group
            SQL_FIND_STANDARD_PATH = (
                "app/sql/v4/grading/find_standard_by_group_and_score_complete.sql"
            )
            find_standard_params = FindStandardByGroupAndScoreSqlParams(
                standard_group_id=standard_group_id_uuid,
                score=score,
            )
            standard_result = cast(
                FindStandardByGroupAndScoreSqlRow | None,
                await execute_sql_typed(
                    conn, SQL_FIND_STANDARD_PATH, params=find_standard_params
                ),
            )

            if not standard_result or not standard_result.id:
                error_msg = (
                    f"No standard found for standard_group_id={standard_group_id_uuid} "
                    f"with score={score}"
                )
                await internal_sio.emit(
                    "grade_grade_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": error_msg,
                    },
                )
                return

            standard_id_uuid = uuid.UUID(standard_result.id)

            # Create feedback record
            SQL_CREATE_FEEDBACK_PATH = "app/sql/v4/grading/create_feedback_complete.sql"
            feedback_params = CreateFeedbackSqlParams(
                grade_id=grade_id_uuid,
                standard_id=standard_id_uuid,
                total=score,
                feedback=feedback,
            )
            feedback_result = cast(
                CreateFeedbackSqlRow,
                await execute_sql_typed(
                    conn, SQL_CREATE_FEEDBACK_PATH, params=feedback_params
                ),
            )

            feedback_id = uuid.UUID(feedback_result.id)

            # Emit completion to client
            await sio.emit(
                "simulations_text_grading_progress",
                {
                    "type": "standard_graded",
                    "chat_id": data.chat_id,
                    "tool_name": data.tool_name,
                    "score": score,
                    "feedback_preview": feedback[:100] + "..."
                    if len(feedback) > 100
                    else feedback,
                },
                room=room,
            )

    except Exception as e:
        await internal_sio.emit(
            "grade_grade_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Failed to finalize: {str(e)}",
            },
        )


@internal_sio.on("grade_grade_complete")  # type: ignore
async def grade_grade_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle grade_grade_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=GradeGradeCompletePayload,
        handler=_grade_grade_complete_impl,  # type: ignore[arg-type]
        error_event_name="grade_grade_error",
        error_response_type=GradeGradeCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/grade_grade_complete",
    GradeGradeCompletePayload,
    "Grade tool completed successfully",
)
