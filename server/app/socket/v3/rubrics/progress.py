"""Handler for rubric_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any, cast

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import (RubricGenerationErrorSqlRow,
                           RubricGenerationProgressApiRequest,
                           RubricGenerationProgressSqlParams,
                           RubricGenerationProgressSqlRow)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/rubrics/rubric_generation_progress_complete.sql"


async def _rubric_progress_impl(
    sid: str,
    data: RubricGenerationProgressApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation using typed SQL execution."""
    try:
        async with get_db_connection() as conn:
            params = RubricGenerationProgressSqlParams(
                **data.model_dump(),
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,
            )
            result = cast(
                RubricGenerationProgressSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit progress event to client using typed wrapper
            await emit_to_client("rubrics_generation_progress", result, room=sid)
    except RuntimeError:
        # Pool not initialized - emit error event
        await emit_to_client(
            "rubrics_generation_error",
            RubricGenerationErrorSqlRow(
                success=False,
                message="Database connection pool not available",
            ),
            room=sid,
        )


@internal_sio.on("rubric_progress")  # type: ignore
async def rubric_progress_internal(data: dict[str, Any]) -> None:
    """Handle rubric_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=RubricGenerationProgressApiRequest,
        handler=_rubric_progress_impl,  # type: ignore[arg-type]
        error_event_name="rubrics_generation_error",
        error_response_type=RubricGenerationErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/generation_progress",
    RubricGenerationProgressSqlRow,
    "Progress update for rubric generation",
)

