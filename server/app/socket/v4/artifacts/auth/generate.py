"""Auth generation handler - resource-based generation through unified pipeline."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.auth.get import get_auth_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.artifacts.auth.types import (
    AUTH_GENERATE_RESOURCE_TYPES,
    GenerateAuthPayload,
)
from app.socket.v4.artifacts.generation_common import (
    emit_generate_artifact,
    emit_generation_error,
)

client_router = APIRouter()
server_router = APIRouter()

async def _generate_auth_impl(
    sid: str,
    data: GenerateAuthPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        if not data.resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="auth",
                message="resource_types must be provided",
                resource_id=str(data.auth_id) if data.auth_id else None,
                resource_type="auth",
            )
            return
        if not data.draft_id:
            await emit_generation_error(
                sid=sid,
                artifact_type="auth",
                message="draft_id is required for auth generation",
                resource_id=str(data.auth_id) if data.auth_id else None,
                resource_type="auth",
            )
            return

        result = await get_auth_websocket(
            profile_id=profile_id,
            auth_id=data.auth_id,
            draft_id=data.draft_id,
        )

        resource_types = [
            rt for rt in data.resource_types if rt in AUTH_GENERATE_RESOURCE_TYPES
        ]
        if not resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="auth",
                message="No valid resource_types provided",
                resource_id=str(data.auth_id) if data.auth_id else None,
                resource_type="auth",
            )
            return

        agent_id: uuid.UUID | None = None
        resource_agent_ids = result.resource_agent_ids or {}
        for rt in resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is not None:
                agent_id = aid
                break

        if not agent_id:
            await emit_generation_error(
                sid=sid,
                artifact_type="auth",
                message="No agent configured for requested resources",
                resource_id=str(data.auth_id) if data.auth_id else None,
                group_id=str(result.group_id) if result.group_id else None,
                resource_type=(resource_types or ["auth"])[0],
            )
            return

        async with get_db_connection() as conn:
            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="auth",
                resource_id=str(data.auth_id) if data.auth_id else None,
                resource_types=resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=result.group_id,
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="auth",
            message=f"Failed to generate auth: {str(e)}",
            resource_id=str(data.auth_id) if data.auth_id else None,
            resource_type="auth",
        )


@sio.event  # type: ignore
async def auth_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle auth_generate client event."""
    try:
        payload = GenerateAuthPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="auth",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.auth_id) if payload.auth_id else None,
                resource_type="auth",
            )
            return

        await _generate_auth_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="auth",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("auth_id")) if data.get("auth_id") else None,
            resource_type="auth",
        )
