"""Persona instructions generation handler."""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.socket.v4.personas.generate import GeneratePersonaPayload
from fastapi import APIRouter

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


async def _instructions_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Handle instructions generation - format context then route to generate_start."""
    try:
        # Get resource IDs from context
        context = data.context or {}
        name_id_str = context.get("name_id")
        description_id_str = context.get("description_id")
        instructions_id_str = context.get("instructions_id")

        # Look up actual values from database using resource IDs
        persona_name_context = ""
        description_context = ""
        current_instructions = ""

        try:
            async with get_db_connection() as conn:
                # Fetch name if name_id provided
                if name_id_str:
                    name_id = uuid.UUID(name_id_str)
                    name_result = await conn.fetchval(
                        "SELECT n.name FROM names n WHERE n.id = $1", name_id
                    )
                    if name_result:
                        persona_name_context = name_result

                # Fetch description if description_id provided
                if description_id_str:
                    description_id = uuid.UUID(description_id_str)
                    description_result = await conn.fetchval(
                        "SELECT d.description FROM descriptions d WHERE d.id = $1",
                        description_id,
                    )
                    if description_result:
                        description_context = description_result

                # Fetch instructions if instructions_id provided
                if instructions_id_str:
                    instructions_id = uuid.UUID(instructions_id_str)
                    instructions_result = await conn.fetchval(
                        "SELECT i.template FROM instructions i WHERE i.id = $1",
                        instructions_id,
                    )
                    if instructions_result:
                        current_instructions = instructions_result
        except RuntimeError:
            # Database pool not initialized - Socket.IO handles logging
            pass
        except Exception:
            # Error fetching resource values - continue with empty strings
            pass

        developer_message_contents = [
            f"""You are generating instructions for a persona. 

Context:
- Persona name: {persona_name_context or "(none)"}
- Description: {description_context or "(none)"}
- Current instructions: {current_instructions or "(none)"}

Generate detailed, comprehensive instructions (4-8 sentences) that define:
- How the persona should behave and respond
- Communication style and tone
- Response patterns and approaches
- Key principles and guidelines
- What to emphasize or avoid

The instructions should be:
- Specific and actionable
- Clear and comprehensive
- Aligned with the persona's description
- Professional and appropriate

You must call the instructions tool with a single instructions string."""
        ]

        # Route to generate_start
        await internal_sio.emit(
            "generate_start",
            {
                "sid": sid,
                "domain_id": None,  # Will need to be provided or looked up
                "resource_id": data.persona_id or data.draft_id,
                "resource_type": "instructions",
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
                error_message=f"Failed to generate instructions: {str(e)}",
                resource_id=data.persona_id,
                group_id=None,
                resource_type="instructions",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def instructions_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle instructions_generate event (client-to-server)."""
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
                    resource_type="instructions",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _instructions_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("persona_id"),
                group_id=None,
                resource_type="instructions",
            ),
            sid=sid,
        )


@internal_sio.on("instructions_generate")  # type: ignore
async def instructions_generate_internal(data: dict[str, Any]) -> None:
    """Handle instructions_generate event from internal bus (server-to-server)."""
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
                    resource_type="instructions",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GeneratePersonaPayload(**data)
        await _instructions_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("persona_id"),
                group_id=None,
                resource_type="instructions",
            ),
            sid=sid,
        )
