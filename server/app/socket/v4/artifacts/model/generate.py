"""Model generation handler.

Routes model generation through unified generate pipeline.
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.model.get import get_model_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.generation_common import (
    emit_generate_artifact,
    emit_generation_error,
)
from app.socket.v4.artifacts.model.types import GenerateModelPayload

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


async def _generate_model_impl(
    sid: str,
    data: GenerateModelPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        if not data.domain_ids:
            await emit_generation_error(
                sid=sid,
                artifact_type="model",
                message="domain_ids must be provided",
                resource_id=str(data.model_id) if data.model_id else None,
                resource_type="model",
            )
            return

        # Fetch model data using typed internal layer
        result = await get_model_websocket(
            profile_id=profile_id,
            model_id=data.model_id,
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
            result.value_domain_id: "values",
            result.endpoint_domain_id: "endpoints",
            result.provider_domain_id: "providers",
            result.key_domain_id: "keys",
            result.flag_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.modalities_domain_id: "modalities",
            result.temperature_levels_domain_id: "temperature_levels",
            result.pricing_domain_id: "pricing",
            result.reasoning_levels_domain_id: "reasoning_levels",
            result.qualities_domain_id: "qualities",
            result.voices_domain_id: "voices",
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
                artifact_type="model",
                message="No valid domain_ids provided",
                resource_id=str(data.model_id) if data.model_id else None,
                resource_type="model",
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
                artifact_type="model",
                message="No agent configured for requested resources",
                resource_id=str(data.model_id) if data.model_id else None,
                group_id=str(result.group_id) if result.group_id else None,
                resource_type=(resource_types or ["model"])[0],
            )
            return

        async with get_db_connection() as conn:
            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="model",
                resource_id=str(data.model_id) if data.model_id else None,
                resource_types=resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=result.group_id,
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="model",
            message=f"Failed to generate model: {str(e)}",
            resource_id=str(data.model_id) if data.model_id else None,
            resource_type="model",
        )


@sio.event  # type: ignore
async def model_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle model_generate client event."""
    try:
        payload = GenerateModelPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="model",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.model_id) if payload.model_id else None,
                resource_type="model",
            )
            return

        await _generate_model_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="model",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("model_id")) if data.get("model_id") else None,
            resource_type="model",
        )
