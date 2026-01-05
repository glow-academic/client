"""Handler for simulation_hints_generate WebSocket event - dispatches to text generation handler."""

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
    data: GenerateHintsApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Internal implementation for hint generation - dispatches to text generation handler."""
    # Inline mapping (no helper function)
    AGENT_ROLE_TO_GENERATION_TYPE = {
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
        "audio": "text",  # Audio agent outputs text
        "image": "image",
        "video": "video",
        "voice": "audio",  # Ephemeral sessions
    }
    
    chat_id = data.chat_id
    message_id = data.message_id
    department_id = data.department_id

    try:
        async with get_db_connection() as conn:
            # Get context AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GenerateHintsSqlParams(
                    message_id=message_id,
                    chat_id=chat_id,
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                )
                result = cast(
                    GenerateHintsSqlRow,
                    await execute_sql_typed(conn, SQL_PATH_GENERATE, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    from app.socket.v4.generate.text.error import \
                        TextErrorPayload
                    await emit_to_internal(
                        "generate_text_error",
                        TextErrorPayload(
                            success=False,
                            message=user_msg,
                        ),
                        sid=sid,
                    )
                    return
                from app.socket.v4.generate.text.error import TextErrorPayload
                await emit_to_internal(
                    "generate_text_error",
                    TextErrorPayload(
                        success=False,
                        message=f"Failed to initialize hint generation: {str(e)}",
                    ),
                    sid=sid,
                )
                return

            if not result:
                from app.socket.v4.generate.text.error import TextErrorPayload
                await emit_to_internal(
                    "generate_text_error",
                    TextErrorPayload(
                        success=False,
                        message=(
                            f"Message {message_id} in chat {chat_id} not found or "
                            f"no hint agent configured for department {department_id}"
                        ),
                    ),
                    sid=sid,
                )
                return

            # Extract agent_role from result
            agent_role = result.agent_role or "hint"
            generation_type = AGENT_ROLE_TO_GENERATION_TYPE.get(agent_role)
            
            if not generation_type:
                from app.socket.v4.generate.text.error import TextErrorPayload
                await emit_to_internal(
                    "generate_text_error",
                    TextErrorPayload(
                        success=False,
                        message=f"Unknown agent role: {agent_role}",
                    ),
                    sid=sid,
                )
                return

            # Transform to standardized payload
            resource_id = uuid.UUID(result.chat_id)  # Use chat_id as resource_id
            
            # Dispatch to generation handler
            await internal_sio.emit(
                f"generate_{generation_type}",
                {
                    "sid": sid,
                    "agent_id": str(result.agent_id),
                    "department_id": str(department_id) if department_id else None,
                    "resource_id": str(resource_id),
                    "resource_type": agent_role,
                    "upload_id": None,  # No audio input for hint
                },
            )
            return  # Exit early - generation handler will handle the rest
    except RuntimeError:
        # Pool not initialized - emit error event
        from app.socket.v4.generate.text.error import TextErrorPayload
        await emit_to_internal(
            "generate_text_error",
            TextErrorPayload(
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        # Emit error event
        from app.socket.v4.generate.text.error import TextErrorPayload
        await emit_to_internal(
            "generate_text_error",
            TextErrorPayload(
                success=False,
                message=f"Hint generation failed: {str(e)}",
            ),
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
        from app.socket.v4.generate.text.error import TextErrorPayload
        await emit_to_internal(
            "generate_text_error",
            TextErrorPayload(
                success=False,
                message="No profile found for socket",
            ),
            sid=sid,
        )
        return

    profile_id = uuid.UUID(profile_id_str)
    await _generate_hints_impl(sid, request, profile_id)


register_client_endpoint(
    client_router,
    "/generate",
    GenerateHintsApiRequest,
    "Generate hints for a simulation message",
)
