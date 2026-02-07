"""Field generation handler - routes field generation through unified generate pipeline.

Uses domain-based API: client sends domain_ids, server derives resource_types + agent_id
from the get_field_websocket() response.
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.field.get import get_field_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.field.types import GenerateFieldPayload
from app.socket.v4.artifacts.generation_common import (
    emit_generate_artifact,
    emit_generation_error,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Field resource types
FIELD_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "parameters",
]


async def _field_generate_impl(
    sid: str, data: GenerateFieldPayload, profile_id: uuid.UUID
) -> None:
    """Handle field generation with domain-based API.

    This function:
    1. Validates domain_ids and derives resource_types + agent_id
    2. Fetches field data via get_field_websocket() for domain mapping
    3. Uses generation_common for actual run creation and emission
    """
    try:
        # Validate domain_ids
        if not data.domain_ids:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="domain_ids must be provided",
                resource_id=str(data.field_id) if data.field_id else None,
                resource_type="field",
            )
            return

        # Step 1: Fetch field data for domain mapping using websocket function
        result = await get_field_websocket(
            profile_id=profile_id,
            field_id=data.field_id,
            draft_id=data.draft_id,
        )

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping from result
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.name_domain_id: "names",
            result.description_domain_id: "descriptions",
            result.flag_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.parameters_domain_id: "parameters",
        }
        # Remove None key if present
        domain_to_resource.pop(None, None)

        # Derive resource_types from domain_ids
        resource_types: list[str] = []
        for did in data.domain_ids:
            if did in domain_to_resource:
                resource_types.append(domain_to_resource[did])

        if not resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="No valid domain_ids provided",
                resource_id=str(data.field_id) if data.field_id else None,
                resource_type="field",
            )
            return

        invalid_types = [rt for rt in resource_types if rt not in FIELD_RESOURCE_TYPES]
        if invalid_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message=f"Invalid resource types: {', '.join(invalid_types)}",
                resource_id=str(data.field_id) if data.field_id else None,
                resource_type="field",
            )
            return

        # Get agent_id from the first valid domain_id
        agent_id: uuid.UUID | None = None
        for did in data.domain_ids:
            if did in domain_to_agent and domain_to_agent[did] is not None:
                agent_id = domain_to_agent[did]
                break

        if not agent_id:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="No agent found for the requested domains",
                resource_id=str(data.field_id) if data.field_id else None,
                group_id=str(result.group_id) if result.group_id else None,
                resource_type="field",
            )
            return

        # Step 2: Use shared generation pipeline with domain-derived agent
        async with get_db_connection() as conn:
            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="field",
                resource_id=str(data.field_id) if data.field_id else None,
                resource_types=resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=result.group_id,
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="field",
            message=f"Failed to generate field: {str(e)}",
            resource_id=str(data.field_id) if data.field_id else None,
            resource_type="field",
        )


@sio.event  # type: ignore
async def field_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle field_generate event (client-to-server)."""
    try:
        payload = GenerateFieldPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.field_id) if payload.field_id else None,
                resource_type="field",
            )
            return

        await _field_generate_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="field",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("field_id")) if data.get("field_id") else None,
            resource_type="field",
        )


@internal_sio.on("field_generate")  # type: ignore
async def field_generate_internal(data: dict[str, Any]) -> None:
    """Handle field_generate event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="Profile not found. Please reconnect.",
                resource_type="field",
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateFieldPayload(**data)
        await _field_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="field",
            message=f"Invalid request: {str(e)}",
            resource_type="field",
        )
