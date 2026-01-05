"""Handler for hints_generate WebSocket event - dispatches to generate_start."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (GenerateHintsApiRequest, GenerateHintsSqlParams,
                           GenerateHintsSqlRow, HintErrorApiRequest)
from fastapi import APIRouter
from jinja2 import Template
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/simulations/generate_hints_complete.sql"


async def _generate_hints_impl(
    sid: str,
    data: GenerateHintsApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Internal implementation for hint generation - dispatches to generate_start."""
    try:
        async with get_db_connection() as conn:
            # Get context from SQL (rate limiting handled in SQL function)
            params = GenerateHintsSqlParams(
                message_id=data.message_id,
                chat_id=data.chat_id,
                department_id=data.department_id,
                profile_id=profile_id,  # From sid lookup
                group_id=data.group_id,  # Optional: for regeneration
                user_instructions=data.user_instructions,  # Optional: for regeneration
            )
            result = cast(
                GenerateHintsSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                error_payload_not_found: HintErrorApiRequest = HintErrorApiRequest(
                    success=False,
                    message=(
                        f"Message {data.message_id} in chat {data.chat_id} not found or "
                        f"no hint agent configured for department {data.department_id}"
                    ),
                    resource_id=str(data.chat_id),
                    group_id=str(data.group_id) if data.group_id else None,
                )
                await emit_to_internal(
                    "hint_error",
                    error_payload_not_found,
                    sid=sid,
                )
                return

            # Render developer instruction template if available (from SQL result)
            developer_message_contents: list[str] = []
            if result.developer_instruction_template:
                try:
                    # Render Jinja template with hint-specific context variables
                    # For hint agent, we might need message content, chat context, etc.
                    # For now, render with empty context (can be extended later)
                    template = Template(result.developer_instruction_template)
                    developer_message_content = template.render(
                        # Add hint-specific context variables here as needed
                        # e.g., message_content=data.message_id, chat_id=data.chat_id
                    )
                    if developer_message_content and developer_message_content.strip():
                        developer_message_contents.append(developer_message_content)
                except Exception:
                    # Template rendering failed - continue without it
                    pass

            # Dispatch to generate_start with developer message contents
            await internal_sio.emit(
                "generate_start",
                {
                    "sid": sid,
                    "agent_id": str(result.agent_id),
                    "resource_id": str(result.chat_id),
                    "resource_type": result.agent_role or "hint",  # Pass agent_role as resource_type
                    "group_id": str(result.group_id) if result.group_id else None,  # Optional: for regeneration
                    "user_instructions": data.user_instructions,  # Optional: for regeneration
                    "message_ids": [str(data.message_id)],  # Hint agent needs message_id for context
                    "developer_message_contents": developer_message_contents if developer_message_contents else None,
                },
            )
            return  # Exit early - generate_start will handle the rest
    except Exception as e:
        # Emit error event directly to hint_error handler (not a generation error yet)
        error_payload_exception: HintErrorApiRequest = HintErrorApiRequest(
            success=False,
            message=f"Hint generation failed: {str(e)}",
            resource_id=str(data.chat_id),
            group_id=str(data.group_id) if data.group_id else None,
        )
        await emit_to_internal(
            "hint_error",
            error_payload_exception,
            sid=sid,
        )


@sio.event  # type: ignore
async def hints_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GenerateHintsApiRequest,
        handler=_generate_hints_impl,  # type: ignore[arg-type]
        error_event_name="hints_error",
        error_response_type=None,  # Error handled via hint_error
    )


@internal_sio.on("hints_generate")
async def hints_generate_internal(data: dict[str, Any]) -> None:
    """Internal event handler for hint generation (called from other handlers)."""
    # Extract sid from payload if available
    sid = data.get("sid", "internal")
    
    # Create request object for handler (no manual parsing - use typed request)
    request = GenerateHintsApiRequest(
        chat_id=uuid.UUID(data["chat_id"]),
        message_id=uuid.UUID(data["message_id"]),
        department_id=uuid.UUID(data["department_id"]),
        group_id=uuid.UUID(data["group_id"]) if data.get("group_id") else None,
        user_instructions=data.get("user_instructions"),
    )

    # Get profile_id from sid lookup
    from app.infra.v4.websocket.find_profile_by_socket import \
        find_profile_by_socket

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        error_payload: HintErrorApiRequest = HintErrorApiRequest(
            success=False,
            message="No profile found for socket",
            resource_id=None,
            group_id=None,
        )
        await emit_to_internal(
            "hint_error",
            error_payload,
            sid=sid,
        )
        return

    profile_id = uuid.UUID(profile_id_str)
    await _generate_hints_impl(sid, request, profile_id)


register_client_endpoint(
    client_router,
    "/generate",
    GenerateHintsApiRequest,
    "Generate or regenerate hints for a simulation message",
)
