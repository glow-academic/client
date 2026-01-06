"""Handler for rubric_title_complete - finalizes create_title tool calls and updates rubric name."""

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
    UpdateRubricNameSqlParams,
    UpdateRubricNameSqlRow,
)

internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH = "app/sql/v4/rubric/update_rubric_name_complete.sql"


class RubricTitleCompletePayload(BaseModel):
    """Rubric title tool complete event."""

    sid: str
    rubric_id: str | None = None
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class RubricTitleCompleteErrorPayload(BaseModel):
    """Error response for rubric title complete."""

    success: bool
    message: str


class RubricTitleToolCompletePayload(BaseModel):
    """Response indicating title tool completed successfully."""

    success: bool
    title: str
    trace_id: str | None = None
    message: str | None = None


async def rubric_title_tool_complete(
    payload: RubricTitleToolCompletePayload, room: str
) -> None:
    await sio.emit("rubrics_tools_title_complete", payload.model_dump(), room=room)


async def _rubric_title_complete_impl(
    sid: str,
    data: RubricTitleCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle rubric_title_complete - parses arguments and updates rubric name."""
    try:
        if not data.rubric_id:
            await internal_sio.emit(
                "rubric_title_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": "Missing rubric_id",
                },
            )
            return

        rubric_id_uuid = uuid.UUID(data.rubric_id)

        async with get_db_connection() as conn:
            # Parse tool arguments to extract title
            try:
                final_args = json.loads(data.arguments_raw)
                title = final_args.get("title", "")
            except json.JSONDecodeError:
                # Try to parse from final_content if arguments_raw is invalid
                try:
                    final_args = json.loads(data.final_content)
                    title = final_args.get("title", "")
                except (json.JSONDecodeError, TypeError):
                    await internal_sio.emit(
                        "rubric_title_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": "Failed to parse tool arguments",
                        },
                    )
                    return

            if not title:
                await internal_sio.emit(
                    "rubric_title_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Missing title in tool arguments",
                    },
                )
                return

            # Update rubric name using execute_sql_typed()
            params = UpdateRubricNameSqlParams(
                profile_id=profile_id,  # From sid lookup
                rubric_id=rubric_id_uuid,
                name=title,
            )
            result = cast(
                UpdateRubricNameSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                await internal_sio.emit(
                    "rubric_title_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to update rubric title",
                    },
                )
                return

            # Emit completion to client
            await rubric_title_tool_complete(
                RubricTitleToolCompletePayload(
                    success=True,
                    title=result.name,  # Use name from SQL result
                    trace_id=None,  # Not available in this context
                    message="Updated rubric title successfully",
                ),
                room=sid,
            )

    except Exception as e:
        await internal_sio.emit(
            "rubric_title_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Failed to finalize: {str(e)}",
            },
        )


@internal_sio.on("rubric_title_complete")  # type: ignore
async def rubric_title_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle rubric_title_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=RubricTitleCompletePayload,
        handler=_rubric_title_complete_impl,  # type: ignore[arg-type]
        error_event_name="rubric_title_error",
        error_response_type=RubricTitleCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/rubric_title_complete",
    RubricTitleCompletePayload,
    "Rubric title tool completed successfully",
)
