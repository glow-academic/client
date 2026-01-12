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
from app.sql.types import (GetPersonaGenerateContextV4SqlParams,
                           GetPersonaGenerateContextV4SqlRow)
from fastapi import APIRouter
from jinja2 import Environment, TemplateError
from jinja2.environment import Template as JinjaTemplate
from pydantic import BaseModel
from utils.logging.db_logger import get_logger
from utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/personas/get_persona_generate_context_v4_complete.sql"
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
    developer_instructions: list[str] | None = (
        None  # Optional: Pre-rendered developer instruction messages
    )
    user_instructions: list[str] | None = (
        None  # Optional: User instructions for regeneration (array of strings)
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

        # Extract resource IDs and convert to UUIDs (before connection block)
        name_id_uuid = uuid.UUID(data.name_id) if data.name_id else None
        description_id_uuid = uuid.UUID(data.description_id) if data.description_id else None
        color_id_uuid = uuid.UUID(data.color_id) if data.color_id else None
        icon_id_uuid = uuid.UUID(data.icon_id) if data.icon_id else None
        instructions_id_uuid = uuid.UUID(data.instructions_id) if data.instructions_id else None
        active_flag_id_uuid = uuid.UUID(data.active_flag_id) if data.active_flag_id else None
        department_ids_uuid = [uuid.UUID(d) for d in data.department_ids] if data.department_ids else None
        field_ids_uuid = [uuid.UUID(f) for f in data.field_ids] if data.field_ids else None
        example_ids_uuid = [uuid.UUID(e) for e in data.example_ids] if data.example_ids else None
        agent_id_uuid = uuid.UUID(data.agent_id) if data.agent_id else None
        group_id_uuid = uuid.UUID(data.group_id) if data.group_id else None

        # Call new SQL function to get agent_id, resources, and developer instruction templates
        async with get_db_connection() as conn:

            params = GetPersonaGenerateContextV4SqlParams(
                profile_id=profile_id,
                resource_types=resource_types,
                agent_id=agent_id_uuid,
                group_id=group_id_uuid,
                name_id=name_id_uuid,
                description_id=description_id_uuid,
                color_id=color_id_uuid,
                icon_id=icon_id_uuid,
                instructions_id=instructions_id_uuid,
                active_flag_id=active_flag_id_uuid,
                department_ids=department_ids_uuid,
                field_ids=field_ids_uuid,
                example_ids=example_ids_uuid,
            )
            result = cast(
                GetPersonaGenerateContextV4SqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.agent_id:
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

            selected_agent_id = result.agent_id

            # Build Jinja template context from resource arrays and fetched resources
            # Use resource arrays directly from payload (these are the list elements)
            context_data: dict[str, Any] = {
                "names": data.names or [],
                "descriptions": data.descriptions or [],
                "colors": data.colors or [],
                "icons": data.icons or [],
                "instructions": data.instructions or [],
                "flags": data.flags or [],
                "departments": data.departments or [],
                "fields": data.fields or [],
                "examples": data.examples or [],
            }

            # Merge with fetched resources from SQL (for IDs that have full objects with whitelist)
            if result.resources:
                # asyncpg automatically converts JSONB to Python dict
                resources_dict = result.resources if isinstance(result.resources, dict) else json.loads(result.resources) if isinstance(result.resources, str) else {}
                
                # Merge fetched resources into context (they may have additional fields)
                for resource_type, resource_list in resources_dict.items():
                    if resource_list and isinstance(resource_list, list):
                        # Merge with existing arrays, preferring fetched objects
                        existing = context_data.get(resource_type, [])
                        if existing:
                            # Combine: use fetched objects if available, otherwise keep existing
                            context_data[resource_type] = resource_list + [item for item in existing if item not in resource_list]
                        else:
                            context_data[resource_type] = resource_list

            # Render developer instruction templates
            developer_instructions: list[str] = []
            if result.developer_instruction_templates:
                env = Environment(
                    autoescape=True,
                    trim_blocks=True,
                    lstrip_blocks=True,
                )
                
                for template_str in result.developer_instruction_templates:
                    if not template_str or not template_str.strip():
                        continue
                    
                    try:
                        template: JinjaTemplate = env.from_string(template_str)
                        rendered_content = template.render(**context_data)
                        
                        if rendered_content and rendered_content.strip():
                            developer_instructions.append(rendered_content.strip())
                    except TemplateError as e:
                        logger.warning(
                            f"Failed to render developer instruction template for agent {selected_agent_id}: {str(e)}"
                        )
                        # Continue with other templates
                        continue
                    except Exception as e:
                        logger.warning(
                            f"Unexpected error rendering developer instruction template: {str(e)}"
                        )
                        continue

            # Determine group_id: prioritize passed group_id, otherwise fetch from database
            passed_group_id: uuid.UUID | None = group_id_uuid

            # Fetch group_ids from database using resource IDs from payload (only if group_id not passed)
            group_ids_map: dict[str, str | None] = {}
            if not passed_group_id:
                # Execute SQL function - returns multiple rows, use fetch() directly
                rows = await conn.fetch(
                    "SELECT * FROM api_get_group_ids_by_resource_ids_v4($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                    profile_id,
                    name_id_uuid,
                    description_id_uuid,
                    color_id_uuid,
                    icon_id_uuid,
                    instructions_id_uuid,
                    active_flag_id_uuid,
                    department_ids_uuid,
                    field_ids_uuid,
                    example_ids_uuid,
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
                        "developer_instructions": developer_instructions if developer_instructions else None,
                        "user_instructions": data.user_instructions if data.user_instructions else None,
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
