"""Handler for scenario_tool_problem_statement WebSocket event."""

import uuid
from typing import Any

from app.main import get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


class ProblemStatementToolPayload(BaseModel):
    trace_id: str
    title: str
    description: str
    scenario_id: str | None = None


class ProblemStatementToolCompletePayload(BaseModel):
    success: bool
    problem_statement_id: str
    trace_id: str
    message: str | None = None


class ProblemStatementToolErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str


async def problem_statement_tool_complete(
    payload: ProblemStatementToolCompletePayload, room: str
) -> None:
    await sio.emit(
        "scenario_tool_problem_statement_complete",
        payload.model_dump(),
        room=room,
    )


async def problem_statement_tool_error(
    payload: ProblemStatementToolErrorPayload, room: str
) -> None:
    await sio.emit("scenario_tool_problem_statement_error", payload.model_dump(), room=room)


@sio.event  # type: ignore
async def scenario_tool_problem_statement(sid: str, data: dict[str, Any]) -> None:
    """Handle problem statement creation event from scenario generation tool."""
    try:
        validated = ProblemStatementToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_tool_problem_statement for {sid}: {e}")
        await problem_statement_tool_error(
            ProblemStatementToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id
    pool = get_pool()

    if not pool:
        await problem_statement_tool_error(
            ProblemStatementToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        async with pool.acquire() as conn:
            # Use description as problem_statement, title as name
            sql = load_sql("sql/v3/problem_statements/insert_problem_statement_complete.sql")
            scenario_id_uuid = uuid.UUID(validated.scenario_id) if validated.scenario_id else None

            result = await conn.fetchrow(
                sql,
                validated.description,  # problem_statement
                validated.title,  # problem_statement_name
                str(scenario_id_uuid) if scenario_id_uuid else None,  # scenario_id (nullable)
                True,  # active
            )

            if not result:
                await problem_statement_tool_error(
                    ProblemStatementToolErrorPayload(
                        success=False,
                        message="Failed to create problem statement",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            problem_statement_id = result["problem_statement_id"]

            logger.info(
                f"✓ Created problem statement {problem_statement_id} "
                f"(scenario_id={scenario_id_uuid}, trace_id={trace_id})"
            )

            await problem_statement_tool_complete(
                ProblemStatementToolCompletePayload(
                    success=True,
                    problem_statement_id=problem_statement_id,
                    trace_id=trace_id,
                    message="Problem statement created successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in scenario_tool_problem_statement for {sid}: {str(e)}", exc_info=True
        )
        await problem_statement_tool_error(
            ProblemStatementToolErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )

