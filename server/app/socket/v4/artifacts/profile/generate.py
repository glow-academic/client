"""Profile generation router - unified handler for all profile resource types."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (GetProfileApiRequest, GetProfileSqlParams,
                           GetProfileSqlRow)
from fastapi import APIRouter
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/profile/get_profile_complete.sql"

# Profile resource types
PROFILE_RESOURCE_TYPES = [
    "names",
    "flags",
    "request_limits",
    "departments",
    "emails",
    "cohorts",
]


class GenerateProfilePayload(GetProfileApiRequest):
    """Request to generate profile resources - extends GET API request with generation-specific fields."""

    agent_type: str | None = None  # Optional: "name", "flags", "departments", "emails", "request_limits", "cohorts"
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions
    staff_id: str | None = None  # Client passes staff_id instead of target_profile_id


def _build_agent_type_map(
    result: GetProfileSqlRow,
) -> dict[str, uuid.UUID | None]:
    """Build agent_type -> agent_id mapping for profile generation."""
    return {
        "name": result.name_agent_id,
        "flags": result.flag_agent_id,
        "departments": result.departments_agent_id,
        "emails": result.emails_agent_id,
        "request_limits": result.request_limit_agent_id,
        "cohorts": result.cohorts_agent_id,
        "basic": result.basic_agent_id,
        "general": result.general_agent_id,
        "all": result.general_agent_id,
    }


async def _profile_generate_impl(
    sid: str, data: GenerateProfilePayload, profile_id: uuid.UUID
) -> None:
    """Handle profile generation - emit generate_artifact with all resource types."""
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="profile",
                    group_id=None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in resource_types if rt not in PROFILE_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="profile",
                    group_id=None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        # Call get_profile_v4 SQL function (same as GET API endpoint)
        async with get_db_connection() as conn:
            target_profile_id = data.target_profile_id or data.staff_id
            params = GetProfileSqlParams(
                profile_id=profile_id,
                target_profile_id=uuid.UUID(target_profile_id)
                if target_profile_id
                else None,
                draft_id=data.draft_id,
            )

            result = cast(
                GetProfileSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            agent_type_map = _build_agent_type_map(result)
            agent_id = agent_type_map.get(data.agent_type or "")

            # Extract resource IDs from arrays and build resources array (composite type format)
            resources: list[dict[str, Any]] = []

            if result.names:
                resources.append({
                    "resource_type": "names",
                    "resource_ids": [str(n.id) for n in result.names if n.id]
                })
            if result.emails:
                resources.append({
                    "resource_type": "emails",
                    "resource_ids": [str(e.id) for e in result.emails if e.id]
                })
            if result.request_limits:
                resources.append({
                    "resource_type": "request_limits",
                    "resource_ids": [str(r.id) for r in result.request_limits if r.id]
                })
            if result.departments:
                resources.append({
                    "resource_type": "departments",
                    "resource_ids": [str(d.department_id) for d in result.departments if d.department_id]
                })
            if result.cohorts:
                resources.append({
                    "resource_type": "cohorts",
                    "resource_ids": [str(c.cohort_id) for c in result.cohorts if c.cohort_id]
                })
            if result.routes:
                resources.append({
                    "resource_type": "routes",
                    "resource_ids": [str(r.route_id) for r in result.routes if r.route_id]
                })
            if result.flag_resource and result.flag_resource.id:
                resources.append({
                    "resource_type": "flags",
                    "resource_ids": [str(result.flag_resource.id)]
                })

            group_id: uuid.UUID | None = result.group_id

            if agent_id:
                await internal_sio.emit(
                    "generate_artifact",
                    {
                        "sid": sid,
                        "artifact_type": "profile",
                        "agent_id": str(agent_id),
                        "resource_types": resource_types,
                        "group_id": str(group_id) if group_id else None,
                        "resources": resources,
                        "user_instructions": data.user_instructions
                        if data.user_instructions
                        else None,
                    },
                )
                return

            # Fallback: emit per-resource using each resource's agent_id
            for resource_type in resource_types:
                per_resource_agent_id = agent_type_map.get(resource_type)
                if not per_resource_agent_id:
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"No agent found for resource_type: {resource_type}",
                            artifact_type="profile",
                            group_id=str(group_id) if group_id else None,
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )
                    continue
                await internal_sio.emit(
                    "generate_artifact",
                    {
                        "sid": sid,
                        "artifact_type": "profile",
                        "agent_id": str(per_resource_agent_id),
                        "resource_types": [resource_type],
                        "group_id": str(group_id) if group_id else None,
                        "resources": resources,
                        "user_instructions": data.user_instructions
                        if data.user_instructions
                        else None,
                    },
                )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate profile resources: {str(e)}",
                artifact_type="profile",
                group_id=None,
                resource_type="profile",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def profile_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle profile_generate event (client-to-server)."""
    try:
        payload = GenerateProfilePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="profile",
                    group_id=None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _profile_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="profile",
                group_id=None,
                resource_type="profile",
            ),
            sid=sid,
        )


@internal_sio.on("profile_generate")  # type: ignore
async def profile_generate_internal(data: dict[str, Any]) -> None:
    """Handle profile_generate event from internal bus (server-to-server)."""
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
                    artifact_type="profile",
                    group_id=None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateProfilePayload(**data)
        await _profile_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="profile",
                group_id=None,
                resource_type="profile",
            ),
            sid=sid,
        )
