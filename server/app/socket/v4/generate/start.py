"""Handler for generate_start WebSocket event - entry point for all generation requests."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.socket.v4.generate.error import GenerateErrorApiRequest
from app.sql.types import (GetGenerationRunContextAndCreateRunSqlParams,
                           GetGenerationRunContextAndCreateRunSqlRow)
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/generate/start/get_generation_run_context_and_create_run_complete.sql"


class GenerateStartApiRequest(BaseModel):
    """Standardized payload for generation start - minimal fields only."""

    sid: str
    agent_id: str
    resource_id: str
    resource_type: str  # agent_role from SQL result
    group_id: str | None = None  # Optional: for regeneration
    user_instructions: str | None = None  # Optional: for regeneration (creates user message)
    # Agent-specific fields - only include what's needed
    message_ids: list[str] | None = None  # Optional: message IDs for context (e.g., hint agent)
    developer_message_contents: list[str] | None = None  # Optional: pre-rendered developer message content strings


# Mapping from agent_role to handler type
HANDLER_MAPPING = {
    # Text generation handlers
    "scenario": "text",
    "document": "text",
    "simulation": "text",
    "grade": "text",
    "hint": "text",
    "classify": "text",
    "member": "text",
    "prompt": "text",
    "rubric": "text",
    "title": "text",
    "audio": "text",
    # Image generation
    "image": "image",
    # Video generation
    "video": "video",
    # Audio generation (ephemeral sessions only)
    "voice": "audio",
}


async def _generate_start_impl(
    sid: str,
    data: GenerateStartApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Entry point for all generation requests - handles mapping, group creation, run creation, rate limiting."""
    try:
        async with get_db_connection() as conn:
            # Call SQL to create group + run + rate limit check + user message (if needed)
            try:
                # Convert message_ids to UUID array if provided
                message_ids_uuid = (
                    [uuid.UUID(mid) for mid in data.message_ids]
                    if data.message_ids
                    else None
                )
                
                params = GetGenerationRunContextAndCreateRunSqlParams(
                    agent_id=uuid.UUID(data.agent_id),
                    resource_id=uuid.UUID(data.resource_id),
                    resource_type=data.resource_type,
                    profile_id=profile_id,
                    message_ids=message_ids_uuid,
                    department_id=None,  # Can be NULL, modality handlers will get it
                    group_id=uuid.UUID(data.group_id) if data.group_id else None,
                    user_instructions=data.user_instructions,
                    developer_message_contents=data.developer_message_contents,
                )
                result = cast(
                    GetGenerationRunContextAndCreateRunSqlRow,
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
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=user_msg,
                            resource_id=data.resource_id,
                            group_id=data.group_id,
                            resource_type=data.resource_type,
                        ),
                        sid=sid,
                    )
                    return
                # Other errors
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to start generation: {str(e)}",
                        resource_id=data.resource_id,
                        group_id=data.group_id,
                        resource_type=data.resource_type,
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create run",
                        resource_id=data.resource_id,
                        group_id=data.group_id,
                        resource_type=data.resource_type,
                    ),
                    sid=sid,
                )
                return

            # Determine handler type from agent_role
            handler_type = HANDLER_MAPPING.get(data.resource_type, "text")
            
            # Build payload for modality handler
            # Modality handlers will fetch agent config, tools, etc. using run_id + agent_id
            modality_payload = {
                "sid": sid,
                "run_id": result.run_id,  # Already created
                "agent_id": data.agent_id,
                "resource_id": data.resource_id,
                "resource_type": data.resource_type,
                "group_id": str(result.group_id),
                "trace_id": result.trace_id,
                "message_ids": [str(mid) for mid in (result.message_ids or [])],  # Includes user message if created
            }
            
            # Dispatch to appropriate modality handler
            # Modality handlers will fetch context using run_id
            if handler_type == "text":
                await internal_sio.emit("generate_text", modality_payload)
            elif handler_type == "image":
                await internal_sio.emit("generate_image", modality_payload)
            elif handler_type == "video":
                await internal_sio.emit("generate_video", modality_payload)
            elif handler_type == "audio":
                await internal_sio.emit("generate_audio", modality_payload)
            else:
                # Fallback to text generation
                await internal_sio.emit("generate_text", modality_payload)
                
    except Exception as e:
        # Emit error to generate_error handler
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to start generation: {str(e)}",
                resource_id=data.resource_id,
                group_id=data.group_id,
                resource_type=data.resource_type,
            ),
            sid=sid,
        )


@internal_sio.on("generate_start")  # type: ignore
async def generate_start_internal(data: dict[str, Any]) -> None:
    """Handle generate_start event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=GenerateStartApiRequest,
        handler=_generate_start_impl,  # type: ignore[arg-type]
        error_event_name="generate_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/generate_start",
    GenerateStartApiRequest,
    "Entry point for all generation requests",
)

