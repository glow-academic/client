"""Handler for rubric_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any, cast

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import (RubricGenerationCompleteApiRequest,
                           RubricGenerationCompleteSqlParams,
                           RubricGenerationCompleteSqlRow,
                           RubricGenerationErrorSqlRow)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/rubrics/rubric_generation_complete_complete.sql"


async def _rubric_complete_impl(
    sid: str,
    data: RubricGenerationCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation using typed SQL execution."""
    try:
        async with get_db_connection() as conn:
            params = RubricGenerationCompleteSqlParams(
                **data.model_dump(),
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,
            )
            result = cast(
                RubricGenerationCompleteSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit complete event to client using typed wrapper
            await emit_to_client("rubrics_generation_complete", result, room=sid)
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


@internal_sio.on("rubric_complete")  # type: ignore
async def rubric_complete_internal(data: dict[str, Any]) -> None:
    """Handle rubric_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=RubricGenerationCompleteApiRequest,
        handler=_rubric_complete_impl,  # type: ignore[arg-type]
        error_event_name="rubrics_generation_error",
        error_response_type=RubricGenerationErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/generation_complete",
    RubricGenerationCompleteSqlRow,
    "Rubric generation completed successfully",
)

