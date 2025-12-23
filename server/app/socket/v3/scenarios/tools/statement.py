"""Handler for scenario_tool_problem_statement WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, sio
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class ProblemStatementToolPayload(BaseModel):
    """Request to create problem statement from scenario generation tool."""

    trace_id: str
    title: str
    description: str
    scenario_id: str | None = None


class ProblemStatementToolCompletePayload(BaseModel):
    """Response indicating problem statement tool completed successfully."""

    success: bool
    problem_statement_id: str
    trace_id: str
    message: str | None = None


class ProblemStatementToolErrorPayload(BaseModel):
    """Response indicating an error occurred in problem statement tool."""

    success: bool
    message: str
    trace_id: str


async def problem_statement_tool_complete(
    payload: ProblemStatementToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[scenario_tool_problem_statement_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"problem_statement_id={payload.problem_statement_id}"
    )
    await sio.emit(
        "scenarios_tools_statement_complete",
        payload.model_dump(),
        room=room,
    )
    logger.info(f"[scenario_tool_problem_statement_complete] Emitted to room={room}")


async def problem_statement_tool_error(
    payload: ProblemStatementToolErrorPayload, room: str
) -> None:
    await sio.emit("scenarios_tools_statement_error", payload.model_dump(), room=room)


async def _scenario_tool_problem_statement_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for problem statement creation."""
    logger.info(
        f"[scenario_tool_problem_statement] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = ProblemStatementToolPayload(**data)
    except ValidationError as e:
        logger.error(
            f"Validation error in scenario_tool_problem_statement for {sid}: {e}"
        )
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
            sql = load_sql(
                "sql/v3/problem_statements/insert_problem_statement_complete.sql"
            )
            scenario_id_uuid = (
                uuid.UUID(validated.scenario_id) if validated.scenario_id else None
            )

            result = await conn.fetchrow(
                sql,
                validated.description,  # problem_statement
                validated.title,  # problem_statement_name
                str(scenario_id_uuid)
                if scenario_id_uuid
                else None,  # scenario_id (nullable)
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
            f"Error in scenario_tool_problem_statement for {sid}: {str(e)}",
            exc_info=True,
        )
        await problem_statement_tool_error(
            ProblemStatementToolErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def scenario_tool_problem_statement(sid: str, data: dict[str, Any]) -> None:
    """Handle problem statement creation event from scenario generation tool (client-to-server)."""
    await _scenario_tool_problem_statement_impl(sid, data)


@internal_sio.on("scenario_tool_problem_statement")
async def scenario_tool_problem_statement_internal(data: dict[str, Any]) -> None:
    """Handle problem statement creation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error(
            "[scenario_tool_problem_statement_internal] Missing 'sid' in payload"
        )
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _scenario_tool_problem_statement_impl(sid, payload)


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/statement", response_model=dict[str, bool])
async def scenario_tool_problem_statement_api(
    request: ProblemStatementToolPayload,
) -> dict[str, bool]:
    """Client-to-server event: Create a problem statement from scenario generation tool."""
    return {"success": True}


@server_router.post("/statement_complete", response_model=dict[str, bool])
async def problem_statement_tool_complete_api(
    request: ProblemStatementToolCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Problem statement tool completed successfully."""
    return {"success": True}
