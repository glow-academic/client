"""Cohort generation router - unified handler for all cohort resource types."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (GetCohortApiRequest, GetCohortSqlParams,
                           GetCohortSqlRow)
from fastapi import APIRouter
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/cohorts/get_cohort_complete.sql"

# Cohort resource types
COHORT_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "simulations",
    "simulation_positions",
]


class GenerateCohortPayload(GetCohortApiRequest):
    """Request to generate cohort resources - extends GET API request with generation-specific fields."""

    agent_type: str | None = None  # Optional: "name", "description", "basic", "general"/"all", "flags", "departments", "simulations"
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


async def _cohort_generate_impl(
    sid: str, data: GenerateCohortPayload, profile_id: uuid.UUID
) -> None:
    """Handle cohort generation - emit generate_artifact for each resource type, then emit client event."""
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in resource_types if rt not in COHORT_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                ),
                sid=sid,
            )
            return

        # Call get_cohort_v4 SQL function (same as GET API endpoint)
        async with get_db_connection() as conn:
            # Convert payload to SQL params (same as GET endpoint)
            params = GetCohortSqlParams(
                profile_id=profile_id,
                cohort_id=data.cohort_id,
                descriptions_search=data.descriptions_search,
                simulation_search=data.simulation_search,
                simulation_show_selected=data.simulation_show_selected,
                current_simulation_ids=data.current_simulation_ids,
                draft_id=data.draft_id,
                mcp=getattr(data, "mcp", False) or False,
            )

            result = cast(
                GetCohortSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Map agent_type to agent_id from response
            agent_id: uuid.UUID | None = None
            if data.agent_type:
                agent_type_map = {
                    "name": result.name_agent_id,
                    "description": result.description_agent_id,
                    "basic": result.basic_agent_id,
                    "general": result.general_agent_id,
                    "all": result.general_agent_id,
                    "flags": result.flag_agent_id,
                    "departments": result.departments_agent_id,
                    "simulations": result.simulations_agent_id,
                    "simulation_positions": result.simulation_positions_agent_id,
                }
                agent_id = agent_type_map.get(data.agent_type)

            if not agent_id:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"No agent found for agent_type: {data.agent_type}",
                        artifact_type="cohort",
                        group_id=None,
                        resource_type="cohort",
                    ),
                    sid=sid,
                )
                return

            # Extract resource IDs from arrays and build resources array (composite type format)
            resources: list[dict[str, Any]] = []

            # Extract IDs from each resource array
            if result.names:
                resources.append({
                    "resource_type": "names",
                    "resource_ids": [str(n.id) for n in result.names if n.id]
                })
            if result.descriptions:
                resources.append({
                    "resource_type": "descriptions",
                    "resource_ids": [str(d.id) for d in result.descriptions if d.id]
                })
            if result.flag_resource and result.flag_resource.id:
                resources.append({
                    "resource_type": "flags",
                    "resource_ids": [str(result.flag_resource.id)]
                })
            if result.departments:
                resources.append({
                    "resource_type": "departments",
                    "resource_ids": [str(d.department_id) for d in result.departments if d.department_id]
                })
            if result.simulations:
                resources.append({
                    "resource_type": "simulations",
                    "resource_ids": [str(s.simulation_id) for s in result.simulations if s.simulation_id]
                })

            # Get group_id from response if available
            group_id: uuid.UUID | None = result.group_id

            # Emit single generate_artifact event with all resource types
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "cohort",
                    "agent_id": str(agent_id),  # Use agent_id from mapping
                    "resource_types": resource_types,  # Pass all resource types at once
                    "group_id": str(group_id) if group_id else None,
                    "resources": resources,  # Pass resources array
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
                error_message=f"Failed to generate cohort resources: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type="cohort",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def cohort_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle cohort_generate event (client-to-server)."""
    try:
        payload = GenerateCohortPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _cohort_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type="cohort",
            ),
            sid=sid,
        )


@internal_sio.on("cohort_generate")  # type: ignore
async def cohort_generate_internal(data: dict[str, Any]) -> None:
    """Handle cohort_generate event from internal bus (server-to-server)."""
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
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateCohortPayload(**data)
        await _cohort_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type="cohort",
            ),
            sid=sid,
        )
