"""Handler for rubric_tool_title WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v3.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import (
    UpdateRubricNameSqlParams,
    UpdateRubricNameSqlRow,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/rubric/update_rubric_name_complete.sql"


class RubricTitleToolPayload(BaseModel):
    """Request to create/update title from rubric generation tool."""

    trace_id: str
    title: str
    rubric_id: str | None = None


class RubricTitleToolCompletePayload(BaseModel):
    """Response indicating title tool completed successfully."""

    success: bool
    title: str
    trace_id: str
    message: str | None = None


class RubricTitleToolErrorPayload(BaseModel):
    """Response indicating an error occurred in title tool."""

    success: bool
    message: str
    trace_id: str


async def rubric_title_tool_complete(
    payload: RubricTitleToolCompletePayload, room: str
) -> None:
    await emit_to_client("rubrics_tools_title_complete", payload, room=room)


async def rubric_title_tool_error(
    payload: RubricTitleToolErrorPayload, room: str
) -> None:
    await emit_to_client("rubrics_tools_title_error", payload, room=room)


async def _rubric_tool_title_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for rubric title creation/update."""
    try:
        validated = RubricTitleToolPayload(**data)
    except ValidationError as e:
        await rubric_title_tool_error(
            RubricTitleToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id

    # Get profile_id from sid lookup
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        await rubric_title_tool_error(
            RubricTitleToolErrorPayload(
                success=False,
                message="Profile not found for socket",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return
    profile_id = uuid.UUID(profile_id_str)

    try:
        async with get_db_connection() as conn:
            rubric_id_uuid = (
                uuid.UUID(validated.rubric_id) if validated.rubric_id else None
            )

            if not rubric_id_uuid:
                await rubric_title_tool_error(
                    RubricTitleToolErrorPayload(
                        success=False,
                        message="rubric_id is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Update rubric name using execute_sql_typed()
            params = UpdateRubricNameSqlParams(
                profile_id=profile_id,  # From sid lookup
                rubric_id=rubric_id_uuid,
                name=validated.title,
            )
            result = cast(
                UpdateRubricNameSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                await rubric_title_tool_error(
                    RubricTitleToolErrorPayload(
                        success=False,
                        message="Failed to update rubric title",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            await rubric_title_tool_complete(
                RubricTitleToolCompletePayload(
                    success=True,
                    title=result.name,  # Use name from SQL result
                    trace_id=trace_id,
                    message="Updated rubric title successfully",
                ),
                room=sid,
            )

    except RuntimeError:
        await rubric_title_tool_error(
            RubricTitleToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
    except Exception as e:
        await rubric_title_tool_error(
            RubricTitleToolErrorPayload(
                success=False,
                message=f"Error updating rubric title: {str(e)}",
                trace_id=trace_id,
            ),
            room=sid,
        )


@internal_sio.on("rubric_tool_title")  # type: ignore
async def rubric_tool_title_internal(data: dict[str, Any]) -> None:
    """Handle rubric_tool_title event from internal bus (server-to-server)."""
    # Extract sid from payload if available, otherwise use a default
    sid = data.get("sid", "internal")
    await _rubric_tool_title_impl(sid, data)


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/rubric_tool_title",
    RubricTitleToolPayload,
    "Create/update rubric title",
)
