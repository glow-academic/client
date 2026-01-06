"""Handler for voice_regenerate WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetVoiceRegenerationRunContextAndCreateRunApiRequest,
    GetVoiceRegenerationRunContextAndCreateRunSqlParams,
    GetVoiceRegenerationRunContextAndCreateRunSqlRow,
)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/simulation_voice_get_voice_regeneration_run_context_and_create_run_complete.sql"

internal_sio = get_internal_sio()


async def _voice_regenerate_impl(
    sid: str,
    data: GetVoiceRegenerationRunContextAndCreateRunApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle voice regeneration requests via WebSocket.

    Note: Voice regeneration creates a new run and links it to the group,
    but the actual regeneration logic (ephemeral key generation, etc.)
    may need to be handled separately based on voice-specific requirements.
    """
    trace_id: str | None = None
    group_id: uuid.UUID | None = None

    try:
        # data fields are already validated as UUIDs by GetVoiceRegenerationRunContextAndCreateRunApiRequest
        # (Pydantic auto-converts strings to UUIDs)
        chat_id = data.chat_id
        group_id_param = data.group_id  # REQUIRED for regeneration
        user_instructions = data.user_instructions

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits, creates run, gets all previous messages,
            # and links existing system_developer messages atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetVoiceRegenerationRunContextAndCreateRunSqlParams(
                    chat_id=chat_id,
                    profile_id=profile_id,  # From sid lookup
                    group_id=group_id_param,  # REQUIRED for regeneration (uses existing group)
                    user_instructions=user_instructions,
                )
                result = cast(
                    GetVoiceRegenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await internal_sio.emit(
                        "simulation_voice_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                        },
                    )
                    return
                await internal_sio.emit(
                    "simulation_voice_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize voice regeneration: {str(e)}",
                    },
                )
                return

            if not result:
                await internal_sio.emit(
                    "simulation_voice_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"No voice agent configured for chat {chat_id}",
                    },
                )
                return

            # result.trace_id comes from groups table
            trace_id = (
                result.trace_id or ""
            )  # From groups.trace_id (never NULL due to DEFAULT)
            if not result.group_id:
                await internal_sio.emit(
                    "simulation_voice_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to retrieve group information",
                    },
                )
                return
            group_id = result.group_id  # Uses existing group

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Get previous messages from result (already properly typed as composite types)
            # Note: Voice regeneration may use these messages differently than other agents
            previous_messages = result.previous_messages or []

            # Emit start event via internal bus
            await internal_sio.emit(
                "simulation_voice_progress",
                {
                    "sid": sid,
                    "chat_id": str(chat_id),
                    "progress_type": "start",
                    "message": "Starting voice regeneration",
                },
            )

            # Rate limit validation and run creation are now handled in SQL
            # (get_voice_regeneration_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Note: Voice regeneration may require additional logic for:
            # - Generating new ephemeral key
            # - Building voice agent with updated context
            # - Formatting tools and persona instructions
            # - Returning configuration to client
            # This is a basic implementation that creates the run and links it to the group.
            # Additional voice-specific regeneration logic can be added as needed.

            # Emit completion event via internal bus
            # trace_id comes from groups table via SQL, not passed in payload
            await internal_sio.emit(
                "simulation_voice_complete",
                {
                    "sid": sid,
                    "chat_id": str(chat_id),
                    "run_id": str(model_run_id),
                    "type": "run_complete",
                    "message": "Voice regeneration run created successfully",
                },
            )

    except RuntimeError:
        # Pool not initialized - emit error event
        await internal_sio.emit(
            "simulation_voice_error",
            {
                "sid": sid,
                "success": False,
                "message": "Database connection pool not available",
            },
        )
    except Exception as e:
        await internal_sio.emit(
            "simulation_voice_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@sio.event  # type: ignore
async def voice_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GetVoiceRegenerationRunContextAndCreateRunApiRequest,
        handler=_voice_regenerate_impl,  # type: ignore[arg-type]
        error_event_name="simulation_voice_error",
        error_response_type=None,  # Voice uses dict payload, not typed response
    )


register_client_endpoint(
    client_router,
    "/regenerate",
    GetVoiceRegenerationRunContextAndCreateRunApiRequest,
    "Regenerate voice simulation using AI",
)
