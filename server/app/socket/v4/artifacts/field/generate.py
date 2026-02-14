"""Field generation handler using resource-type routing."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.field.get import get_field_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.field.types import GenerateFieldPayload
from app.infra.v4.websocket.generation_common import (
    emit_generate_artifact,
    emit_generation_error,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

FIELD_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "conditional_parameters",
]

FIELD_RESOURCE_TYPE_TO_INTERNAL = {
    "names": "names",
    "descriptions": "descriptions",
    "flags": "flags",
    "departments": "departments",
    "conditional_parameters": "parameters",
}


async def _field_generate_impl(
    sid: str,
    data: GenerateFieldPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        if not data.resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="resource_types must be provided",
                resource_id=str(data.field_id) if data.field_id else None,
                resource_type="field",
            )
            return

        resource_types = data.resource_types
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

        result = await get_field_websocket(
            profile_id=profile_id,
            field_id=data.field_id,
            draft_id=data.draft_id,
        )

        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = None
        for rt in resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is None and rt == "conditional_parameters":
                aid = resource_agent_ids.get("parameters")
            if aid is not None:
                agent_id = aid
                break

        if not agent_id:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="No agent found for requested resource_types",
                resource_id=str(data.field_id) if data.field_id else None,
                group_id=str(result.group_id) if result.group_id else None,
                resource_type="field",
            )
            return

        internal_resource_types = [
            FIELD_RESOURCE_TYPE_TO_INTERNAL.get(rt, rt) for rt in resource_types
        ]

        async with get_db_connection() as conn:
            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="field",
                resource_id=str(data.field_id) if data.field_id else None,
                resource_types=internal_resource_types,
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

        payload = GenerateFieldPayload(**data)
        await _field_generate_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="field",
            message=f"Invalid request: {str(e)}",
            resource_type="field",
        )
