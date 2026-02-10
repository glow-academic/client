"""Department generation handler - resource-based generation through unified pipeline."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.department.get import get_department_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.department.types import GenerateDepartmentPayload
from app.socket.v4.artifacts.generation_common import (
    emit_generate_artifact,
    emit_generation_error,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Department resource types
DEPARTMENT_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "settings",
]


async def _generate_department_impl(
    sid: str,
    data: GenerateDepartmentPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        # Validate resource_types
        if not data.resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="department",
                message="resource_types must be provided",
                resource_id=str(data.department_id) if data.department_id else None,
                resource_type="department",
            )
            return

        # Step 1: Fetch department data for resource -> agent mapping
        result = await get_department_websocket(
            profile_id=profile_id,
            department_id=data.department_id,
            draft_id=data.draft_id,
        )

        resource_types = [
            rt for rt in data.resource_types if rt in DEPARTMENT_RESOURCE_TYPES
        ]
        if not resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="department",
                message="No valid resource_types provided",
                resource_id=str(data.department_id) if data.department_id else None,
                resource_type="department",
            )
            return

        # Get agent_id from the first valid resource type
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
                artifact_type="department",
                message="No agent configured for requested resources",
                resource_id=str(data.department_id) if data.department_id else None,
                group_id=str(result.group_id) if result.group_id else None,
                resource_type=(resource_types or ["department"])[0],
            )
            return

        async with get_db_connection() as conn:
            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="department",
                resource_id=str(data.department_id) if data.department_id else None,
                resource_types=resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=result.group_id,
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="department",
            message=f"Failed to generate department: {str(e)}",
            resource_id=str(data.department_id) if data.department_id else None,
            resource_type="department",
        )


@sio.event  # type: ignore
async def department_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle department_generate client event."""
    try:
        payload = GenerateDepartmentPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="department",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.department_id)
                if payload.department_id
                else None,
                resource_type="department",
            )
            return

        await _generate_department_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="department",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("department_id"))
            if data.get("department_id")
            else None,
            resource_type="department",
        )
