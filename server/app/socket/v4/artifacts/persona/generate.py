"""Persona generation router - unified handler for all persona resource types.

This module handles all business logic for persona generation:
- Rate limit validation (fail fast)
- Group/run creation
- Agent/model context fetching
- Jinja template rendering for developer instructions
- Message insertion with deduplication

The AI handler (generate.py) receives a simplified payload with pre-rendered content.
"""

import uuid
from typing import Any, cast

from pydantic import BaseModel

from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetPersonaApiRequest,
    GetPersonaResourceTreeSqlParams,
    GetPersonaResourceTreeSqlRow,
    GetPersonaSqlParams,
    GetPersonaSqlRow,
    QGetPersonaResourceTreeV4Node,
)
from fastapi import APIRouter
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths
SQL_PATH = "app/sql/v4/queries/personas/get_persona_complete.sql"
RESOURCE_TREE_SQL_PATH = (
    "app/sql/v4/queries/personas/get_persona_resource_tree_complete.sql"
)
GET_GROUP_IDS_BY_RESOURCE_IDS_SQL_PATH = (
    "app/sql/v4/queries/personas/get_group_ids_by_resource_ids_complete.sql"
)
# New SQL paths for business logic separation
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/persona/prepare_persona_generation_complete.sql"
)
SQL_PATH_INSERT_MESSAGES = (
    "app/sql/v4/queries/generate/persona/insert_generation_messages_complete.sql"
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


class PreparePersonaGenerationSqlParams(BaseModel):
    """Parameters for prepare_persona_generation SQL function."""

    p_profile_id: uuid.UUID
    p_agent_id: uuid.UUID
    p_group_id: uuid.UUID | None = None
    p_resources: list[dict[str, Any]] | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        # Convert resources to SQL composite type format
        resources = None
        if self.p_resources:
            resources = [
                (r["resource_type"], [uuid.UUID(rid) for rid in r["resource_ids"]])
                for r in self.p_resources
            ]
        return (
            self.p_profile_id,
            self.p_agent_id,
            self.p_group_id,
            resources,
        )


class InsertGenerationMessagesSqlParams(BaseModel):
    """Parameters for insert_generation_messages SQL function."""

    p_run_id: uuid.UUID
    p_developer_messages: list[str] | None = None
    p_user_messages: list[str] | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.p_run_id,
            self.p_developer_messages,
            self.p_user_messages,
        )


async def _persona_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Handle persona generation with all business logic.

    This function:
    1. Validates resource types
    2. Fetches persona data and maps agent_type to agent_id
    3. Expands resources via tree traversal
    4. Calls prepare_persona_generation SQL (rate limit, group/run, context)
    5. Renders developer instructions with Jinja
    6. Inserts pre-rendered messages
    7. Emits simplified payload to generate_artifact handler
    """
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
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
                "generate_call_error",
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

        async with get_db_connection() as conn:
            # Step 1: Fetch persona data to get agent_id mapping
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
                    "generate_call_error",
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

            # Step 2: Seed resource nodes from the persona GET result
            seed_nodes: list[QGetPersonaResourceTreeV4Node] = []

            def add_seed(resource_type: str, resource_id: uuid.UUID | None) -> None:
                if resource_id:
                    seed_nodes.append(
                        QGetPersonaResourceTreeV4Node(
                            resource_type=resource_type,
                            resource_id=resource_id,
                        )
                    )

            if result.names:
                for name in result.names:
                    add_seed("names", name.id)
            if result.descriptions:
                for desc in result.descriptions:
                    add_seed("descriptions", desc.id)
            if result.colors:
                for color in result.colors:
                    add_seed("colors", color.id)
            if result.icons:
                for icon in result.icons:
                    add_seed("icons", icon.id)
            if result.instructions:
                for instruction in result.instructions:
                    add_seed("instructions", instruction.id)
            if result.flags:
                for flag in result.flags:
                    add_seed("flags", flag.id)
            if result.departments:
                for dept in result.departments:
                    add_seed("departments", dept.department_id)
            if result.fields:
                for field in result.fields:
                    add_seed("fields", field.field_id)
            if result.examples:
                for example in result.examples:
                    add_seed("examples", example.id)

            # Step 3: Expand seed nodes via resource tree traversal
            resources: list[dict[str, Any]] = []
            if seed_nodes:
                resource_tree_params = GetPersonaResourceTreeSqlParams(
                    profile_id=profile_id,
                    seed_nodes=seed_nodes,
                )
                resource_tree_result = cast(
                    GetPersonaResourceTreeSqlRow,
                    await execute_sql_typed(
                        conn,
                        RESOURCE_TREE_SQL_PATH,
                        params=resource_tree_params,
                    ),
                )

                resources_by_type: dict[str, set[str]] = {}
                for node in resource_tree_result.resources or []:
                    if not node.resource_type or not node.resource_id:
                        continue
                    resources_by_type.setdefault(node.resource_type, set()).add(
                        str(node.resource_id)
                    )

                resources = [
                    {
                        "resource_type": resource_type,
                        "resource_ids": sorted(resource_ids),
                    }
                    for resource_type, resource_ids in resources_by_type.items()
                ]

            # Get group_id from persona response if available
            existing_group_id: uuid.UUID | None = result.group_id

            # Step 4: Prepare generation (rate limit, group/run, context)
            # This SQL function handles rate limit validation (fail fast),
            # group/run creation, and fetches all context in one call
            try:
                prepare_sql = load_sql(SQL_PATH_PREPARE)
                prepare_params = PreparePersonaGenerationSqlParams(
                    p_profile_id=profile_id,
                    p_agent_id=agent_id,
                    p_group_id=existing_group_id,
                    p_resources=resources if resources else None,
                )
                prepare_row = await conn.fetchrow(prepare_sql, *prepare_params.to_tuple())

                if not prepare_row:
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="Failed to prepare persona generation",
                            artifact_type="persona",
                            group_id=str(existing_group_id) if existing_group_id else None,
                            resource_type="persona",
                        ),
                        sid=sid,
                    )
                    return

            except Exception as e:
                error_msg = str(e)
                # Check for rate limit error (fail fast)
                if "RATE_LIMIT_EXCEEDED" in error_msg:
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else "Rate limit exceeded. Please try again later."
                    )
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=user_msg,
                            artifact_type="persona",
                            group_id=str(existing_group_id) if existing_group_id else None,
                            resource_type="persona",
                        ),
                        sid=sid,
                    )
                    return
                raise

            # Extract context from prepare result
            run_id = prepare_row["run_id"]
            group_id = prepare_row["group_id"]
            trace_id = prepare_row["trace_id"]
            agent_name = prepare_row["agent_name"]
            system_prompt = prepare_row["system_prompt"]
            model_name = prepare_row["model_name"]
            provider_name = prepare_row["provider_name"]
            base_url = prepare_row["base_url"]
            api_key = prepare_row["api_key"]
            temperature = prepare_row["temperature"]
            reasoning = prepare_row["reasoning"]
            voice = prepare_row["voice"]
            quality = prepare_row["quality"]
            tools = prepare_row["tools"]
            developer_instruction_templates = prepare_row["developer_instruction_templates"]
            jinja_context = prepare_row["jinja_context"]

            # Step 5: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 6: Insert pre-rendered messages
            insert_sql = load_sql(SQL_PATH_INSERT_MESSAGES)
            insert_params = InsertGenerationMessagesSqlParams(
                p_run_id=run_id,
                p_developer_messages=rendered_developer_messages if rendered_developer_messages else None,
                p_user_messages=data.user_instructions if data.user_instructions else None,
            )
            insert_row = await conn.fetchrow(insert_sql, *insert_params.to_tuple())

            if not insert_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to insert generation messages",
                        artifact_type="persona",
                        group_id=str(group_id) if group_id else None,
                        resource_type="persona",
                    ),
                    sid=sid,
                )
                return

            message_id = insert_row["message_id"]
            messages = insert_row["messages"]

            # Step 7: Emit simplified payload to generate_artifact handler
            # The AI handler only needs to decrypt API key and stream LLM
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "persona",
                    "resource_type": resource_types[0] if resource_types else "persona",
                    "run_id": str(run_id),
                    "group_id": str(group_id) if group_id else None,
                    "message_id": str(message_id) if message_id else None,
                    "messages": (
                        ([{"role": "system", "content": system_prompt}] if system_prompt else [])
                        + [{"role": "developer", "content": m} for m in rendered_developer_messages]
                        + (messages if isinstance(messages, list) else [])
                    ),
                    "llm_config": {
                        "model": model_name,
                        "api_key": api_key,
                        "base_url": base_url,
                        "temperature": temperature,
                        "reasoning": reasoning,
                        "provider": provider_name,
                        "voice": voice,
                        "quality": quality,
                        "length_seconds": None,
                    },
                    "tools": convert_tools_to_dict(tools),
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        logger.exception(f"Failed to generate persona resources: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
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
                "generate_call_error",
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
            "generate_call_error",
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
                "generate_call_error",
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
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="persona",
                group_id=None,
                resource_type="persona",
            ),
            sid=sid,
        )
