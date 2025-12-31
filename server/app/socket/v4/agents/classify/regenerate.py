"""Handler for classify_regenerate WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetUploadClassificationRegenerationRunContextAndCreateRunApiRequest,
    GetUploadClassificationRegenerationRunContextAndCreateRunSqlParams,
    GetUploadClassificationRegenerationRunContextAndCreateRunSqlRow,
)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v4/uploads/get_upload_classification_regeneration_run_context_and_create_run_complete.sql"
)

internal_sio = get_internal_sio()


async def _classify_regenerate_impl(
    sid: str,
    data: GetUploadClassificationRegenerationRunContextAndCreateRunApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle classification regeneration requests via WebSocket.
    
    Note: Classification regeneration creates a new run and links it to the group,
    but the actual regeneration logic (file extraction, parameter items, tool creation, etc.)
    may need to be handled separately based on classification-specific requirements.
    """
    group_id: uuid.UUID | None = None

    try:
        # data fields are already validated as UUIDs
        upload_id = data.upload_id
        department_id = data.department_id
        group_id_param = data.group_id  # REQUIRED for regeneration
        user_instructions = data.user_instructions

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            try:
                params = GetUploadClassificationRegenerationRunContextAndCreateRunSqlParams(
                    upload_id=upload_id,
                    profile_id=profile_id,
                    department_id=department_id,
                    group_id=group_id_param,  # REQUIRED for regeneration
                    user_instructions=user_instructions,
                )
                result = cast(
                    GetUploadClassificationRegenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await sio.emit(
                        "uploads_classification_error",
                        {
                            "success": False,
                            "message": user_msg,
                        },
                        room=sid,
                    )
                    return
                await sio.emit(
                    "uploads_classification_error",
                    {
                        "success": False,
                        "message": f"Failed to initialize classification regeneration: {str(e)}",
                    },
                    room=sid,
                )
                return

            if not result:
                await sio.emit(
                    "uploads_classification_error",
                    {
                        "success": False,
                        "message": "Classification agent not found",
                    },
                    room=sid,
                )
                return

            if not result.group_id:
                await sio.emit(
                    "uploads_classification_error",
                    {
                        "success": False,
                        "message": "Failed to retrieve group information",
                    },
                    room=sid,
                )
                return
            group_id = result.group_id

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Get previous messages from result
            previous_messages = result.previous_messages or []

            # Emit start event
            await sio.emit(
                "uploads_classification_progress",
                {
                    "type": "start",
                    "message": "Starting classification regeneration",
                },
                room=sid,
            )

            # Rate limit validation and run creation are now handled in SQL
            # Additional classification-specific regeneration logic can be added here

            # Emit completion event
            await sio.emit(
                "uploads_classification_complete",
                {
                    "success": True,
                    "message": "Classification regeneration run created successfully",
                    "suggestedParameterItemIds": {},  # Empty for now - can be populated with actual results
                },
                room=sid,
            )

    except RuntimeError:
        await sio.emit(
            "uploads_classification_error",
            {
                "success": False,
                "message": "Database connection pool not available",
            },
            room=sid,
        )
    except Exception as e:
        await sio.emit(
            "uploads_classification_error",
            {
                "success": False,
                "message": str(e),
            },
            room=sid,
        )


@sio.event  # type: ignore
async def classify_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GetUploadClassificationRegenerationRunContextAndCreateRunApiRequest,
        handler=_classify_regenerate_impl,  # type: ignore[arg-type]
        error_event_name="uploads_classification_error",
        error_response_type=None,
    )


register_client_endpoint(
    client_router,
    "/regenerate",
    GetUploadClassificationRegenerationRunContextAndCreateRunApiRequest,
    "Regenerate upload classification using AI",
)

