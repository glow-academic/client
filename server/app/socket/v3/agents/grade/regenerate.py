"""Handler for grade_regenerate WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_client_event
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetGradingRegenerationRunContextAndCreateRunApiRequest,
    GetGradingRegenerationRunContextAndCreateRunSqlParams,
    GetGradingRegenerationRunContextAndCreateRunSqlRow,
)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v3/grading/get_grading_regeneration_run_context_and_create_run_complete.sql"
)

internal_sio = get_internal_sio()


async def _grade_regenerate_impl(
    sid: str,
    data: GetGradingRegenerationRunContextAndCreateRunApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle grading regeneration requests via WebSocket.
    
    Note: Grading regeneration creates a new run and links it to the group,
    but the actual regeneration logic (standard grading, tool calls, etc.)
    may need to be handled separately based on grading-specific requirements.
    """
    group_id: uuid.UUID | None = None

    try:
        # data fields are already validated as UUIDs
        chat_id = data.chat_id
        department_id = data.department_id
        group_id_param = data.group_id  # REQUIRED for regeneration
        user_instructions = data.user_instructions

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            try:
                params = GetGradingRegenerationRunContextAndCreateRunSqlParams(
                    chat_id=chat_id,
                    department_id=department_id,
                    profile_id=profile_id,
                    group_id=group_id_param,  # REQUIRED for regeneration
                    user_instructions=user_instructions,
                )
                result = cast(
                    GetGradingRegenerationRunContextAndCreateRunSqlRow,
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
                        "simulations_text_grading_progress",
                        {
                            "type": "error",
                            "chat_id": str(chat_id),
                            "message": user_msg,
                            "error": user_msg,
                        },
                        room=f"simulation_{chat_id}",
                    )
                    return
                await sio.emit(
                    "simulations_text_grading_progress",
                    {
                        "type": "error",
                        "chat_id": str(chat_id),
                        "message": f"Failed to initialize grading regeneration: {str(e)}",
                        "error": str(e),
                    },
                    room=f"simulation_{chat_id}",
                )
                return

            if not result:
                await sio.emit(
                    "simulations_text_grading_progress",
                    {
                        "type": "error",
                        "chat_id": str(chat_id),
                        "message": "Grading agent not found",
                        "error": "Grading agent not found",
                    },
                    room=f"simulation_{chat_id}",
                )
                return

            if not result.group_id:
                await sio.emit(
                    "simulations_text_grading_progress",
                    {
                        "type": "error",
                        "chat_id": str(chat_id),
                        "message": "Failed to retrieve group information",
                        "error": "Failed to retrieve group information",
                    },
                    room=f"simulation_{chat_id}",
                )
                return
            group_id = result.group_id

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Get previous messages from result
            previous_messages = result.previous_messages or []

            # Emit start event
            await sio.emit(
                "simulations_text_grading_progress",
                {
                    "type": "start",
                    "chat_id": str(chat_id),
                    "message": "Starting grading regeneration",
                },
                room=f"simulation_{chat_id}",
            )

            # Rate limit validation and run creation are now handled in SQL
            # Additional grading-specific regeneration logic can be added here

            # Emit completion event
            await sio.emit(
                "simulations_text_grading_progress",
                {
                    "type": "complete",
                    "chat_id": str(chat_id),
                    "message": "Grading regeneration run created successfully",
                },
                room=f"simulation_{chat_id}",
            )

    except RuntimeError:
        await sio.emit(
            "simulations_text_grading_progress",
            {
                "type": "error",
                "chat_id": str(chat_id) if chat_id else "",
                "message": "Database connection pool not available",
                "error": "Database connection pool not available",
            },
            room=f"simulation_{chat_id}" if chat_id else sid,
        )
    except Exception as e:
        await sio.emit(
            "simulations_text_grading_progress",
            {
                "type": "error",
                "chat_id": str(chat_id) if chat_id else "",
                "message": str(e),
                "error": str(e),
            },
            room=f"simulation_{chat_id}" if chat_id else sid,
        )


@sio.event  # type: ignore
async def grade_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GetGradingRegenerationRunContextAndCreateRunApiRequest,
        handler=_grade_regenerate_impl,  # type: ignore[arg-type]
        error_event_name="simulations_text_grading_error",
        error_response_type=None,
    )


register_client_endpoint(
    client_router,
    "/regenerate",
    GetGradingRegenerationRunContextAndCreateRunApiRequest,
    "Regenerate grading using AI",
)

