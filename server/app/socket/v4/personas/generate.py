"""Persona generation router - unified handler for all persona resource types."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (GetBestAgentForPersonaResourcesV4SqlParams,
                           GetBestAgentForPersonaResourcesV4SqlRow)
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/personas/get_best_agent_for_persona_resources_v4_complete.sql"
GET_GROUP_IDS_BY_RESOURCE_IDS_SQL_PATH = (
    "app/sql/v4/personas/get_group_ids_by_resource_ids_complete.sql"
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


class GeneratePersonaPayload(BaseModel):
    """Request to generate persona resources - completely resource-agnostic."""

    artifact_type: str = "persona"  # Artifact type identifier
    resource_types: list[str] | None = None  # Array of resource types to generate
    resource_type: str | None = (
        None  # Single resource type (for backward compatibility)
    )
    instructions: str | None = (
        None  # Optional: For regeneration (renamed from user_instructions)
    )
    group_id: str | None = (
        None  # Optional: Group ID (used for all resources if provided)
    )
    group_ids: dict[str, str | None] | None = (
        None  # Optional: resource_type -> group_id mapping for regeneration
    )
    agent_id: str | None = (
        None  # Optional: Agent ID from GET endpoint (frontend passes based on resource type)
    )
    # Flattened resource IDs (removed context object)
    name_id: str | None = None
    names: list[str] | None = None
    description_id: str | None = None
    descriptions: list[str] | None = None
    color_id: str | None = None
    colors: list[str] | None = None
    icon_id: str | None = None
    icons: list[str] | None = None
    instructions_id: str | None = None
    instructions: list[str] | None = None
    active_flag_id: str | None = None
    flags: list[str] | None = None
    field_ids: list[str] | None = None
    fields: list[str] | None = None
    department_ids: list[str] | None = None
    departments: list[str] | None = None
    example_ids: list[str] | None = None
    examples: list[str] | None = None


async def _persona_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Handle persona generation - emit generate_artifact for each resource type, then emit client event."""
    try:
        # Determine resource types to generate
        resource_types: list[str] = []
        if data.resource_types:
            resource_types = data.resource_types
        elif data.resource_type:
            resource_types = [data.resource_type]
        else:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Either resource_types or resource_type must be provided",
                    artifact_type="persona",
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        # Validate resource types
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

        # Use agent_id from payload if provided (from GET endpoint), otherwise fall back to SQL lookup
        selected_agent_id: uuid.UUID | None = None
        if data.agent_id:
            try:
                selected_agent_id = uuid.UUID(data.agent_id)
            except ValueError:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Invalid agent_id format",
                        artifact_type="persona",
                        group_id=None,
                        resource_type="persona",
                    ),
                    sid=sid,
                )
                return
        else:
            # Fallback: Get best agent_id based on tool-to-resource matching
            async with get_db_connection() as conn:
                params = GetBestAgentForPersonaResourcesV4SqlParams(
                    profile_id=profile_id,
                    resource_types=resource_types,
                )
                result = cast(
                    GetBestAgentForPersonaResourcesV4SqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )

                # Extract agent_id from result
                agent_id_value = result.agent_id if result else None
                if not agent_id_value:
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="Could not find suitable agent for persona generation",
                            artifact_type="persona",
                            group_id=None,
                            resource_type="persona",
                        ),
                        sid=sid,
                    )
                    return

                selected_agent_id = agent_id_value

        if not selected_agent_id:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent_id provided and could not find suitable agent",
                    artifact_type="persona",
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        # Determine group_id: prioritize passed group_id, otherwise fetch from database
        passed_group_id: uuid.UUID | None = None
        if data.group_id:
            try:
                passed_group_id = uuid.UUID(data.group_id)
            except ValueError:
                # Invalid UUID, treat as None
                passed_group_id = None

        # Fetch group_ids from database using resource IDs from payload (only if group_id not passed)
        group_ids_map: dict[str, str | None] = {}
        if not passed_group_id:
            async with get_db_connection() as conn:
                # Extract resource IDs from root level payload (flattened structure)
                name_id = uuid.UUID(data.name_id) if data.name_id else None
                description_id = uuid.UUID(data.description_id) if data.description_id else None
                color_id = uuid.UUID(data.color_id) if data.color_id else None
                icon_id = uuid.UUID(data.icon_id) if data.icon_id else None
                instructions_id = uuid.UUID(data.instructions_id) if data.instructions_id else None
                active_flag_id = uuid.UUID(data.active_flag_id) if data.active_flag_id else None
                department_ids = [uuid.UUID(d) for d in data.department_ids] if data.department_ids else None
                field_ids = [uuid.UUID(f) for f in data.field_ids] if data.field_ids else None
                example_ids = [uuid.UUID(e) for e in data.example_ids] if data.example_ids else None

                # Execute SQL function - returns multiple rows, use fetch() directly
                rows = await conn.fetch(
                    "SELECT * FROM api_get_group_ids_by_resource_ids_v4($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                    profile_id,
                    name_id,
                    description_id,
                    color_id,
                    icon_id,
                    instructions_id,
                    active_flag_id,
                    department_ids,
                    field_ids,
                    example_ids,
                )

                # Build group_ids map from result rows
                for row in rows:
                    resource_type = row["resource_type"]
                    group_id = row["group_id"]
                    if group_id:
                        group_ids_map[resource_type] = str(group_id)

        # Emit generate_artifact events for each resource type
        for resource_type in resource_types:
            # Use passed group_id if available, otherwise get from database lookup
            if passed_group_id:
                group_id = passed_group_id
            else:
                group_id_str = group_ids_map.get(resource_type)
                group_id = None
                if group_id_str:
                    try:
                        group_id = uuid.UUID(group_id_str)
                    except ValueError:
                        # Invalid UUID, treat as None
                        group_id = None

            # Get message_ids from previous runs if regenerating (group_id exists)
            message_ids: list[str] | None = None
            if group_id:
                # TODO: Retrieve message_ids from previous runs in the group
                # For now, pass None - the generate_artifact handler will handle it
                message_ids = None

            # Emit generate_artifact internal event for each resource type
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": data.artifact_type,  # Pass artifact_type through
                    "agent_id": str(selected_agent_id),  # Use agent_id directly
                    "resource_types": [resource_type],  # Use resource_types array
                    "group_id": str(group_id)
                    if group_id
                    else None,  # Pass group_id (string or None)
                    "instructions": data.instructions,  # Renamed from user_instructions
                    "message_ids": message_ids,
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
