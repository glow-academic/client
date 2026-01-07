"""Handler for rubric_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import (
    RubricGenerationErrorApiRequest,
    RubricGenerationErrorSqlParams,
    RubricGenerationErrorSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/rubric/rubric_generation_error_complete.sql"


async def _rubric_error_impl(
    sid: str,
    data: RubricGenerationErrorApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation using typed SQL execution."""
    # #region agent log
    import json
    with open('/Users/ashoksaravanan/Coding/glow/.cursor/debug.log', 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"B","location":"old/agents/rubric/error.py:35","message":"Creating SQL params","data":{"data_fields":list(data.model_dump().keys()),"group_id":str(group_id) if group_id else None,"profile_id":str(profile_id)},"timestamp":int(__import__('time').time()*1000)})+"\n")
    # #endregion
    try:
        async with get_db_connection() as conn:
            # Exclude group_id from data_dump since we pass it explicitly
            # This avoids KeyError when group_id is None in the validated model
            data_dump = data.model_dump(exclude={"group_id"})
            params = RubricGenerationErrorSqlParams(
                **data_dump,
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,
            )
            result = cast(
                RubricGenerationErrorSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit error event to client using typed wrapper
            await emit_to_client("rubrics_generation_error", result, room=sid)
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


# DISABLED: Old handler replaced by v4/rubric/error.py
# The v4 handler emits unified artifact_generation_error events
# @internal_sio.on("rubric_error")  # type: ignore
# async def rubric_error_internal(data: dict[str, Any]) -> None:
#     """Handle rubric_error event from internal bus (server-to-server)."""
#     await handle_internal_event(
#         data=data,
#         request_type=RubricGenerationErrorApiRequest,
#         handler=_rubric_error_impl,  # type: ignore[arg-type]
#         error_event_name="rubrics_generation_error",
#         error_response_type=RubricGenerationErrorSqlRow,
#     )


register_server_endpoint(
    server_router,
    "/generation_error",
    RubricGenerationErrorSqlRow,
    "Error occurred during rubric generation",
)
