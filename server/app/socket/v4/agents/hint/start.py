"""Handler for simulation_hints_generate WebSocket event - dispatches to generate_start."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (GenerateHintsApiRequest, GenerateHintsSqlParams,
                           GenerateHintsSqlRow)
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_GENERATE = "app/sql/v4/simulations/generate_hints_complete.sql"


async def _generate_hints_impl(
    sid: str,
    data: GenerateHintsApiRequest | dict[str, Any],  # Accept dict for regenerate
    profile_id: uuid.UUID,
) -> None:
    """Internal implementation for hint generation - dispatches to generate_start."""
    # Handle both GenerateHintsApiRequest and dict (for regenerate)
    if isinstance(data, dict):
        chat_id = uuid.UUID(data["chat_id"]) if isinstance(data["chat_id"], str) else data["chat_id"]
        message_id = uuid.UUID(data["message_id"]) if isinstance(data["message_id"], str) else data["message_id"]
        department_id = uuid.UUID(data["department_id"]) if isinstance(data["department_id"], str) else data["department_id"]
        group_id = uuid.UUID(data["group_id"]) if data.get("group_id") else None
        user_instructions = data.get("user_instructions")
    else:
        chat_id = data.chat_id
        message_id = data.message_id
        department_id = data.department_id
        # Optional parameters for regeneration
        group_id = getattr(data, "group_id", None)
        user_instructions = getattr(data, "user_instructions", None)

    try:
        async with get_db_connection() as conn:
            # Get context from SQL (rate limiting handled in generate/start.py)
            # Use execute_sql_typed() - auto-detects function
            params = GenerateHintsSqlParams(
                message_id=message_id,
                chat_id=chat_id,
                department_id=department_id,
                profile_id=profile_id,  # From sid lookup
                group_id=group_id,  # Optional: for regeneration
                user_instructions=user_instructions,  # Optional: for regeneration
            )
            result = cast(
                GenerateHintsSqlRow,
                await execute_sql_typed(conn, SQL_PATH_GENERATE, params=params),
            )

            if not result:
                await emit_to_internal(
                    "generate_error",
                    {
                        "sid": sid,
                        "error_message": (
                            f"Message {message_id} in chat {chat_id} not found or "
                            f"no hint agent configured for department {department_id}"
                        ),
                        "resource_id": str(chat_id),
                        "group_id": str(result.group_id) if result and result.group_id else None,
                        "resource_type": "hint",
                    },
                    sid=sid,
                )
                return

            # Transform to standardized payload for generate_start
            resource_id = uuid.UUID(result.chat_id)  # Use chat_id as resource_id
            
            # Dispatch to generate_start - it will handle mapping, group creation, run creation, rate limiting
            await internal_sio.emit(
                "generate_start",
                {
                    "sid": sid,
                    "agent_id": str(result.agent_id),
                    "resource_id": str(resource_id),
                    "resource_type": result.agent_role or "hint",  # Pass agent_role as resource_type
                    "department_id": str(department_id) if department_id else None,
                    "upload_id": None,  # No audio input for hint
                    "group_id": str(result.group_id) if result.group_id else None,  # Pass group_id for regeneration
                    "user_instructions": user_instructions,  # Pass user_instructions for regeneration
                    "message_id": str(message_id),  # Original message for regeneration
                },
            )
            return  # Exit early - generate_start will handle the rest
    except Exception as e:
        # Emit error event to generate_error handler
        await emit_to_internal(
            "generate_error",
            {
                "sid": sid,
                "error_message": f"Hint generation failed: {str(e)}",
                "resource_id": str(chat_id) if "chat_id" in locals() else None,
                "group_id": str(group_id) if group_id else None,
                "resource_type": "hint",
            },
            sid=sid,
        )


@sio.event  # type: ignore
async def simulation_hints_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GenerateHintsApiRequest,
        handler=_generate_hints_impl,  # type: ignore[arg-type]
        error_event_name="simulation_hints_error",
        error_response_type=None,  # Error handled via generate_text_error
    )


@internal_sio.on("simulation_hints_generate")
async def simulation_hints_generate_internal(data: dict[str, Any]) -> None:
    """Internal event handler for hint generation (called from other handlers)."""
    # Extract sid from payload if available
    sid = data.get("sid", "internal")
    chat_id = uuid.UUID(data["chat_id"])
    message_id = uuid.UUID(data["message_id"])
    department_id = uuid.UUID(data["department_id"])

    # Create request object for handler
    request = GenerateHintsApiRequest(
        chat_id=chat_id,
        message_id=message_id,
        department_id=department_id,
    )

    # Get profile_id from sid lookup
    from app.infra.v4.websocket.find_profile_by_socket import \
        find_profile_by_socket

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        await emit_to_internal(
            "generate_error",
            {
                "sid": sid,
                "error_message": "No profile found for socket",
                "resource_id": None,
                "group_id": None,
                "resource_type": "hint",
            },
            sid=sid,
        )
        return

    profile_id = uuid.UUID(profile_id_str)
    await _generate_hints_impl(sid, request, profile_id)


# Pydantic model for regenerate request (extends generate with required group_id)
class HintRegenerateApiRequest(BaseModel):
    """Request to regenerate hints for a simulation message."""

    chat_id: uuid.UUID
    message_id: uuid.UUID
    department_id: uuid.UUID
    group_id: uuid.UUID  # Required for regeneration
    user_instructions: str | None = None


@sio.event  # type: ignore
async def simulation_hints_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper for regenerate - calls generate handler with group_id and user_instructions"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=HintRegenerateApiRequest,
        handler=_generate_hints_impl,  # type: ignore[arg-type]
        error_event_name="simulation_hints_error",
        error_response_type=None,  # Error handled via generate_text_error
    )


register_client_endpoint(
    client_router,
    "/generate",
    GenerateHintsApiRequest,
    "Generate hints for a simulation message",
)

register_client_endpoint(
    client_router,
    "/regenerate",
    HintRegenerateApiRequest,
    "Regenerate hints for a simulation message",
)
