"""Handler for scenario_tool_title WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import load_sql

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class ScenarioTitleToolPayload(BaseModel):
    """Request to create/update title from scenario generation tool."""

    trace_id: str
    title: str
    scenario_id: str | None = None


class ScenarioTitleToolCompletePayload(BaseModel):
    """Response indicating title tool completed successfully."""

    success: bool
    title: str
    trace_id: str
    message: str | None = None


class ScenarioTitleToolErrorPayload(BaseModel):
    """Response indicating an error occurred in title tool."""

    success: bool
    message: str
    trace_id: str


async def scenario_title_tool_complete(
    payload: ScenarioTitleToolCompletePayload, room: str
) -> None:
    await emit_to_client("scenarios_tools_title_complete", payload, room=room)


async def scenario_title_tool_error(
    payload: ScenarioTitleToolErrorPayload, room: str
) -> None:
    await emit_to_client("scenarios_tools_title_error", payload, room=room)


async def _scenario_tool_title_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for scenario title creation/update."""
    try:
        validated = ScenarioTitleToolPayload(**data)
    except ValidationError as e:
        await scenario_title_tool_error(
            ScenarioTitleToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id

    try:
        async with get_db_connection() as conn:
            scenario_id_uuid = (
                uuid.UUID(validated.scenario_id) if validated.scenario_id else None
            )

            if not scenario_id_uuid:
                await scenario_title_tool_error(
                    ScenarioTitleToolErrorPayload(
                        success=False,
                        message="scenario_id is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Update scenario name
            sql = load_sql("app/sql/v3/scenario/update_scenario_name.sql")
            result = await conn.fetchrow(
                sql,
                str(scenario_id_uuid),
                validated.title,
            )

            if not result:
                await scenario_title_tool_error(
                    ScenarioTitleToolErrorPayload(
                        success=False,
                        message="Failed to update scenario title",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            await scenario_title_tool_complete(
                ScenarioTitleToolCompletePayload(
                    success=True,
                    title=validated.title,
                    trace_id=trace_id,
                    message="Updated scenario title successfully",
                ),
                room=sid,
            )

    except RuntimeError:
        await scenario_title_tool_error(
            ScenarioTitleToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
    except Exception as e:
        await scenario_title_tool_error(
            ScenarioTitleToolErrorPayload(
                success=False,
                message=f"Error updating scenario title: {str(e)}",
                trace_id=trace_id,
            ),
            room=sid,
        )


@internal_sio.on("scenario_tool_title")  # type: ignore
async def scenario_tool_title_internal(data: dict[str, Any]) -> None:
    """Handle scenario_tool_title event from internal bus (server-to-server)."""
    # Extract sid from payload if available, otherwise use a default
    sid = data.get("sid", "internal")
    await _scenario_tool_title_impl(sid, data)


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/scenario_tool_title",
    ScenarioTitleToolPayload,
    "Create/update scenario title",
)
