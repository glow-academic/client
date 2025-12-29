"""Handler for standard_group_descriptions_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any, cast

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import (StandardGroupDescriptionsErrorSqlRow,
                           StandardGroupDescriptionsProgressApiRequest,
                           StandardGroupDescriptionsProgressSqlParams,
                           StandardGroupDescriptionsProgressSqlRow)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/rubrics/standard_group_descriptions/standard_group_descriptions_progress_complete.sql"


async def _standard_group_descriptions_progress_impl(
    sid: str,
    data: StandardGroupDescriptionsProgressApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation using typed SQL execution."""
    try:
        async with get_db_connection() as conn:
            params = StandardGroupDescriptionsProgressSqlParams(
                **data.model_dump(),
                profile_id=profile_id,
                group_id=group_id,
            )
            result = cast(
                StandardGroupDescriptionsProgressSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit progress event to client using typed wrapper
            await emit_to_client(
                "rubrics_tools_standard_group_descriptions_progress",
                result,
                room=sid,
            )
    except RuntimeError:
        await emit_to_client(
            "rubrics_tools_standard_group_descriptions_error",
            StandardGroupDescriptionsErrorSqlRow(
                success=False,
                message="Database connection pool not available",
            ),
            room=sid,
        )


@internal_sio.on("standard_group_descriptions_progress")  # type: ignore
async def standard_group_descriptions_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle standard_group_descriptions_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=StandardGroupDescriptionsProgressApiRequest,
        handler=_standard_group_descriptions_progress_impl,  # type: ignore[arg-type]
        error_event_name="rubrics_tools_standard_group_descriptions_error",
        error_response_type=StandardGroupDescriptionsErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/standard_group_descriptions_progress",
    StandardGroupDescriptionsProgressSqlRow,
    "Progress update for standard group descriptions tool",
)

