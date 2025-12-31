"""Handler for rubric_tool_standard_description WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.sql.types import (
    StandardGroupDescriptionsCompleteApiRequest,
    StandardGroupDescriptionsErrorSqlRow,
    UpdateStandardDescriptionsApiRequest,
    UpdateStandardDescriptionsSqlParams,
    UpdateStandardDescriptionsSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/rubrics/update_standard_descriptions_complete.sql"


async def _rubric_tool_standard_description_impl(
    sid: str,
    data: UpdateStandardDescriptionsApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for standard descriptions update (replaces standard_group_descriptions)."""
    try:
        async with get_db_connection() as conn:
            params = UpdateStandardDescriptionsSqlParams(
                rubric_id=data.rubric_id,
                descriptions=data.descriptions,
                profile_id=profile_id,
                group_id=group_id,
            )
            result = cast(
                UpdateStandardDescriptionsSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or result.updated_count is None:
                await emit_to_internal(
                    "standard_description_error",
                    StandardGroupDescriptionsErrorSqlRow(
                        success=False,
                        message="Failed to update standard descriptions",
                    ),
                    sid=sid,
                    group_id=str(result.group_id)
                    if result and result.group_id
                    else None,
                )
                return

            # Invalidate rubrics cache
            await invalidate_tags(["rubrics", f"rubric:{str(data.rubric_id)}"])

            # Emit to internal complete event (will be handled by complete.py)
            await emit_to_internal(
                "standard_description_complete",
                StandardGroupDescriptionsCompleteApiRequest(
                    success=True,
                    rubric_id=data.rubric_id,
                    updated_count=result.updated_count,
                    message=f"Updated {result.updated_count} standard descriptions successfully",
                    descriptions=result.descriptions,  # From SQL result (composite types array)
                ),
                sid=sid,
                group_id=str(result.group_id) if result.group_id else None,
            )
    except RuntimeError:
        await emit_to_internal(
            "standard_description_error",
            StandardGroupDescriptionsErrorSqlRow(
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
            group_id=str(group_id) if group_id else None,
        )
    except Exception as e:
        await emit_to_internal(
            "standard_description_error",
            StandardGroupDescriptionsErrorSqlRow(
                success=False,
                message=str(e),
            ),
            sid=sid,
            group_id=str(group_id) if group_id else None,
        )


@internal_sio.on("rubric_tool_standard_description")  # type: ignore
async def rubric_tool_standard_description_internal(
    data: dict[str, Any],
) -> None:
    """Handle rubric_tool_standard_description event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=UpdateStandardDescriptionsApiRequest,
        handler=_rubric_tool_standard_description_impl,  # type: ignore[arg-type]
        error_event_name="standard_description_error",
        error_response_type=StandardGroupDescriptionsErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/rubric_tool_standard_description",
    UpdateStandardDescriptionsApiRequest,
    "Standard description tool handler (replaces standard_group_descriptions)",
)
