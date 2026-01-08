"""Persona descriptions generation handler."""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.socket.v4.personas.generate import GeneratePersonaPayload
from fastapi import APIRouter

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


async def _descriptions_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Handle descriptions generation - format context then route to generate_start."""
    try:
        # Format context for description generation
        context = data.context or {}
        persona_name_context = context.get("name", "")
        current_description = context.get("description", "")

        developer_message_contents = [
            f"""You are generating a description for a persona. 

Context:
- Persona name: {persona_name_context or "(none)"}
- Current description: {current_description or "(none)"}

Generate a detailed, comprehensive description (2-4 sentences) that captures:
- The persona's personality traits
- Communication style and tone
- Key behavioral characteristics
- Role and purpose

The description should be:
- Specific and actionable
- Professional and appropriate
- Clear and concise

You must call the descriptions tool with a single description string."""
        ]

        # Route to generate_start
        await internal_sio.emit(
            "generate_start",
            {
                "sid": sid,
                "domain_id": None,  # Will need to be provided or looked up
                "resource_id": data.persona_id or data.draft_id,
                "resource_type": "descriptions",
                "group_id": None,
                "user_instructions": None,
                "message_ids": None,
                "developer_message_contents": developer_message_contents,
            },
        )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate descriptions: {str(e)}",
                resource_id=data.persona_id,
                group_id=None,
                resource_type="descriptions",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def descriptions_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle descriptions_generate event (client-to-server)."""
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
                    resource_type="descriptions",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _descriptions_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("persona_id"),
                group_id=None,
                resource_type="descriptions",
            ),
            sid=sid,
        )


@internal_sio.on("descriptions_generate")  # type: ignore
async def descriptions_generate_internal(data: dict[str, Any]) -> None:
    """Handle descriptions_generate event from internal bus (server-to-server)."""
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
                    resource_type="descriptions",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GeneratePersonaPayload(**data)
        await _descriptions_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("persona_id"),
                group_id=None,
                resource_type="descriptions",
            ),
            sid=sid,
        )
