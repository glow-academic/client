"""Persona generation router - unified handler for all persona resource types."""

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

# Persona resource types
PERSONA_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "colors",
    "icons",
    "instructions",
    "flags",
    "examples",
    "fields",
    "departments",
]


class GeneratePersonaPayload(BaseModel):
    """Request to generate persona resources."""

    draft_id: str
    resource_types: list[str] | None = None  # Array of resource types to generate
    resource_type: str | None = None  # Single resource type (for backward compatibility)
    persona_id: str | None = None
    context: dict[str, Any] | None = None  # Additional context for generation
    user_instructions: str | None = None  # Optional: For regeneration
    group_ids: dict[str, str | None] | None = None  # Optional: resource_type -> group_id mapping for regeneration


async def _persona_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Handle persona generation - emit generate_artifact for each resource type, then emit client event."""
    try:
        # Determine resource types to generate
        resource_types: list[str] = []
        if data.resource_types:
            resource_types = data.resource_types
        elif data.resource_type:
            resource_types = [data.resource_type]
        else:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Either resource_types or resource_type must be provided",
                    resource_id=data.persona_id or data.draft_id,
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        # Validate resource types
        invalid_types = [rt for rt in resource_types if rt not in PERSONA_RESOURCE_TYPES]
        if invalid_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    resource_id=data.persona_id or data.draft_id,
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        # For now, emit dummy generate_artifact events (skeleton implementation)
        # TODO: Implement actual AI generation logic
        for resource_type in resource_types:
            # Get group_id for this resource type if regenerating
            group_id = None
            if data.group_ids and resource_type in data.group_ids:
                group_id_str = data.group_ids[resource_type]
                if group_id_str:
                    try:
                        group_id = uuid.UUID(group_id_str)
                    except ValueError:
                        # Invalid UUID, treat as None
                        group_id = None

            # Emit generate_artifact internal event for each resource type
            # Note: This is a skeleton - agent_id and other required fields need to be determined
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "agent_id": "",  # TODO: Look up agent_id from persona domain/department
                    "resource_id": data.persona_id or data.draft_id,
                    "resource_type": resource_type,
                    "group_id": str(group_id) if group_id else None,  # Pass group_id (string or None)
                    "user_instructions": data.user_instructions,  # Pass user_instructions
                    "message_ids": None,
                    "developer_message_contents": None,  # TODO: Format context for each resource type
                },
            )

        # Emit personas_generation_start client event to notify client
        await sio.emit(
            "personas_generation_start",
            {
                "resource_types": resource_types,
                "draft_id": data.draft_id,
                "persona_id": data.persona_id,
                "success": True,
                "message": f"Started generation for {len(resource_types)} resource type(s)",
            },
            room=sid,
        )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate persona resources: {str(e)}",
                resource_id=data.persona_id or data.draft_id,
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
