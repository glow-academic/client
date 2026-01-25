"""Persona generation router - unified handler for all persona resource types."""

import json
import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (GetPersonaApiRequest, GetPersonaSqlParams,
                           GetPersonaSqlRow)
from fastapi import APIRouter
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/personas/get_persona_complete.sql"
GET_GROUP_IDS_BY_RESOURCE_IDS_SQL_PATH = (
    "app/sql/v4/queries/personas/get_group_ids_by_resource_ids_complete.sql"
)

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


class GeneratePersonaPayload(GetPersonaApiRequest):
    """Request to generate persona resources - extends GET API request with generation-specific fields."""

    agent_type: str | None = None  # Optional: "name", "description", "basic", "content", "general"/"all"
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


async def _persona_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Handle persona generation - emit generate_artifact for each resource type, then emit client event."""
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="persona",
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in resource_types if rt not in PERSONA_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="persona",
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        # Map agent_type to agent_id from response (will be done after fetching persona data)

        # Call get_persona_v4 SQL function (same as GET API endpoint)
        async with get_db_connection() as conn:
            # Convert payload to SQL params (same as GET endpoint)
            params = GetPersonaSqlParams(
                profile_id=profile_id,
                persona_id=data.persona_id,
                color_search=data.color_search,
                icon_search=data.icon_search,
                color_show_selected=data.color_show_selected,
                icon_show_selected=data.icon_show_selected,
                descriptions_search=data.descriptions_search,
                instructions_search=data.instructions_search,
                field_search=data.field_search,
                field_show_selected=data.field_show_selected,
                draft_id=data.draft_id,
                mcp=getattr(data, "mcp", False) or False,
            )

            result = cast(
                GetPersonaSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Map agent_type to agent_id from response
            agent_id: uuid.UUID | None = None
            if data.agent_type:
                agent_type_map = {
                    "name": result.name_agent_id,
                    "description": result.description_agent_id,
                    "color": result.color_agent_id,
                    "icon": result.icon_agent_id,
                    "instructions": result.instructions_agent_id,
                    "flags": result.flag_agent_id,
                    "departments": result.departments_agent_id,
                    "fields": result.fields_agent_id,
                    "examples": result.examples_agent_id,
                    "basic": result.basic_agent_id,
                    "content": result.content_agent_id,
                    "general": result.general_agent_id,
                    "all": result.general_agent_id,
                }
                agent_id = agent_type_map.get(data.agent_type)

            if not agent_id:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"No agent found for agent_type: {data.agent_type}",
                        artifact_type="persona",
                        group_id=str(result.group_id) if result.group_id else None,
                        resource_type="persona",
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
            if result.colors:
                resources.append({
                    "resource_type": "colors",
                    "resource_ids": [str(c.id) for c in result.colors if c.id]
                })
            if result.icons:
                resources.append({
                    "resource_type": "icons",
                    "resource_ids": [str(i.id) for i in result.icons if i.id]
                })
            if result.instructions:
                resources.append({
                    "resource_type": "instructions",
                    "resource_ids": [str(inst.id) for inst in result.instructions if inst.id]
                })
            if result.flags:
                resources.append({
                    "resource_type": "flags",
                    "resource_ids": [str(f.id) for f in result.flags if f.id]
                })
            if result.departments:
                resources.append({
                    "resource_type": "departments",
                    "resource_ids": [str(d.department_id) for d in result.departments if d.department_id]
                })
            if result.fields:
                resources.append({
                    "resource_type": "fields",
                    "resource_ids": [str(f.field_id) for f in result.fields if f.field_id]
                })
            if result.examples:
                resources.append({
                    "resource_type": "examples",
                    "resource_ids": [str(e.id) for e in result.examples if e.id]
                })

            # Get group_id from response if available
            group_id: uuid.UUID | None = result.group_id

            # Emit single generate_artifact event with all resource types
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "persona",
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
                error_message=f"Failed to generate persona resources: {str(e)}",
                artifact_type="persona",
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
                    artifact_type="persona",
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
                artifact_type="persona",
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
                    artifact_type="persona",
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
                artifact_type="persona",
                group_id=None,
                resource_type="persona",
            ),
            sid=sid,
        )
