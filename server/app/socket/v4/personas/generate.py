"""Persona generation router - routes to resource-specific handlers."""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GeneratePersonaPayload(BaseModel):
    """Request to generate a persona resource."""

    draft_id: str
    resource_type: str  # "names", "descriptions", "instructions"
    persona_id: str | None = None
    context: dict[str, Any] | None = None  # Additional context for generation


async def _persona_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Route to resource-specific handler based on resource_type."""
    try:
        resource_type = data.resource_type

        # Route to appropriate handler (import here to avoid circular imports)
        if resource_type == "names":
            from . import names
            await names._names_generate_impl(sid, data, profile_id)
        elif resource_type == "descriptions":
            from . import descriptions
            await descriptions._descriptions_generate_impl(sid, data, profile_id)
        elif resource_type == "instructions":
            from . import instructions
            await instructions._instructions_generate_impl(sid, data, profile_id)
        else:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Unknown resource type: {resource_type}",
                    resource_id=data.persona_id,
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to route persona generation: {str(e)}",
                resource_id=data.persona_id,
                group_id=None,
                resource_type="persona",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def persona_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle persona_generate event (client-to-server)."""
    try:
        payload = GeneratePersonaPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    resource_id=data.get("persona_id"),
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _persona_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("persona_id"),
                group_id=None,
                resource_type="persona",
            ),
            sid=sid,
        )


@internal_sio.on("persona_generate")  # type: ignore
async def persona_generate_internal(data: dict[str, Any]) -> None:
    """Handle persona_generate event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    resource_id=data.get("persona_id"),
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GeneratePersonaPayload(**data)
        await _persona_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("persona_id"),
                group_id=None,
                resource_type="persona",
            ),
            sid=sid,
        )
