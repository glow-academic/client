"""Handler for scenario_tool_problem_statement WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import load_sql

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class TitleDescriptionToolPayload(BaseModel):
    """Request to create problem statement from scenario generation tool."""

    trace_id: str
    title: str
    description: str
    scenario_id: str | None = None


async def _title_description_tool_call_impl(
    sid: str,
    data: TitleDescriptionToolPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for problem statement creation."""
    try:
        async with get_db_connection() as conn:
            sql = load_sql(
                "app/sql/v4/problem_statements/insert_problem_statement_complete.sql"
            )
            scenario_id_uuid = uuid.UUID(data.scenario_id) if data.scenario_id else None

            result = await conn.fetchrow(
                sql,
                data.description,  # problem_statement
                data.title,  # problem_statement_name
                str(scenario_id_uuid)
                if scenario_id_uuid
                else None,  # scenario_id (nullable)
                True,  # active
            )

            if not result:
                await emit_to_internal(
                    "title_description_error",
                    {
                        "success": False,
                        "message": "Failed to create problem statement",
                        "trace_id": data.trace_id,
                    },
                    sid=sid,
                    group_id=str(group_id) if group_id else None,
                )
                return

            problem_statement_id = result["problem_statement_id"]

            await emit_to_internal(
                "title_description_complete",
                {
                    "success": True,
                    "problem_statement_id": problem_statement_id,
                    "trace_id": data.trace_id,
                    "message": "Problem statement created successfully",
                },
                sid=sid,
                group_id=str(group_id) if group_id else None,
            )
    except RuntimeError:
        await emit_to_internal(
            "title_description_error",
            {
                "success": False,
                "message": "Database connection pool not available",
                "trace_id": data.trace_id,
            },
            sid=sid,
            group_id=str(group_id) if group_id else None,
        )
    except Exception as e:
        await emit_to_internal(
            "title_description_error",
            {
                "success": False,
                "message": str(e),
                "trace_id": data.trace_id,
            },
            sid=sid,
            group_id=str(group_id) if group_id else None,
        )


@internal_sio.on("scenario_tool_problem_statement")  # type: ignore
async def scenario_tool_problem_statement_internal(
    data: dict[str, Any],
) -> None:
    """Handle problem statement creation event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=TitleDescriptionToolPayload,
        handler=_title_description_tool_call_impl,  # type: ignore[arg-type]
        error_event_name="title_description_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/title_description",
    TitleDescriptionToolPayload,
    "Create problem statement from scenario generation tool",
)
