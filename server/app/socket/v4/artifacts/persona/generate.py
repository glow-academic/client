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

from fastapi import APIRouter

from app.api.v4.artifacts.persona.get import get_persona_websocket
from app.api.v4.artifacts.persona.types import (
    GetPersonaWebsocketResponse,
    PersonaResourceBucket,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.persona.permissions import (
    GenerationContext,
    format_generation_error,
    validate_generation_access,
)
from app.socket.v4.artifacts.persona.types import GeneratePersonaPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetPersonaGenerationContextSqlParams,
    GetPersonaGenerationContextSqlRow,
    GetPersonaResourceTreeSqlParams,
    GetPersonaResourceTreeSqlRow,
    IPersonaResourceV4,
    PreparePersonaGenerationSqlParams,
    PreparePersonaGenerationSqlRow,
    QGetPersonaResourceTreeV4Node,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths
RESOURCE_TREE_SQL_PATH = (
    "app/sql/v4/queries/personas/get_persona_resource_tree_complete.sql"
)
GET_GROUP_IDS_BY_RESOURCE_IDS_SQL_PATH = (
    "app/sql/v4/queries/personas/get_group_ids_by_resource_ids_complete.sql"
)
# New SQL paths for business logic separation
SQL_PATH_CONTEXT = (
    "app/sql/v4/queries/generate/persona/get_persona_generation_context_complete.sql"
)
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/persona/prepare_persona_generation_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
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
    "parameter_fields",
    "departments",
    "parameters",
]


def _serialize_resource_item(item: Any) -> Any:
    if item is None:
        return None
    if hasattr(item, "model_dump"):
        return item.model_dump()
    if hasattr(item, "_asdict"):
        return dict(item._asdict())
    if hasattr(item, "dict"):
        return item.dict()
    if isinstance(item, dict):
        return item
    return item


def _serialize_resource_list(items: list[Any] | None) -> list[Any]:
    if not items:
        return []
    return [
        serialized
        for item in items
        if (serialized := _serialize_resource_item(item)) is not None
    ]


def _build_persona_jinja_context(
    response: GetPersonaWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from persona websocket response."""

    if response.resources and response.resources.resources:
        resources = response.resources.resources.model_dump()
        current = (
            response.resources.current.model_dump()
            if response.resources.current
            else PersonaResourceBucket().model_dump()
        )
        resources["current"] = current
        return resources
    return {"current": PersonaResourceBucket().model_dump()}


async def _persona_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Handle persona generation with all business logic.

    This function:
    1. Validates resource_types and resolves agent_id from domain mappings
    2. Fetches persona data via internal function for seed nodes
    3. Expands resources via tree traversal
    4. Calls prepare_persona_generation SQL (rate limit, group/run, context)
    5. Renders developer instructions with Jinja
    6. Inserts pre-rendered messages
    7. Emits simplified payload to generate_artifact handler
    """
    try:
        # Validate resource_types
        if not data.resource_types:
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

        if not data.draft_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Draft ID is required for persona generation",
                    artifact_type="persona",
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        resource_types = data.resource_types

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

        # Step 1: Fetch persona data for seed nodes using websocket function
        result = await get_persona_websocket(
            profile_id=profile_id,
            persona_id=data.persona_id,
            draft_id=data.draft_id,
        )

        # Get agent_id from the first resource type that has an agent assigned
        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = None
        for rt in resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is not None:
                agent_id = aid
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested resource types",
                    artifact_type="persona",
                    group_id=None,
                    resource_type="persona",
                ),
                sid=sid,
            )
            return

        persona_jinja_context = _build_persona_jinja_context(result, resource_types)

        # Step 2: Seed resource nodes from the persona GET result (ONLY requested types)
        seed_nodes: list[QGetPersonaResourceTreeV4Node] = []

        def add_seed(resource_type: str, resource_id: uuid.UUID | None) -> None:
            # Only seed requested resource types for Jinja context and tool filtering
            if resource_id and resource_type in resource_types:
                seed_nodes.append(
                    QGetPersonaResourceTreeV4Node(
                        resource_type=resource_type,
                        resource_id=resource_id,
                    )
                )

        # Access resources from nested structure
        resources_bucket = result.resources.resources if result.resources else None

        if resources_bucket and resources_bucket.names:
            for name in resources_bucket.names:
                add_seed("names", name.id)
        if resources_bucket and resources_bucket.descriptions:
            for desc in resources_bucket.descriptions:
                add_seed("descriptions", desc.id)
        if resources_bucket and resources_bucket.colors:
            for color in resources_bucket.colors:
                add_seed("colors", color.id)
        if resources_bucket and resources_bucket.icons:
            for icon in resources_bucket.icons:
                add_seed("icons", icon.id)
        if resources_bucket and resources_bucket.instructions:
            for instruction in resources_bucket.instructions:
                add_seed("instructions", instruction.id)
        if resources_bucket and resources_bucket.flags:
            for flag in resources_bucket.flags:
                add_seed("flags", flag.flag_option_id)
        if resources_bucket and resources_bucket.departments:
            for dept in resources_bucket.departments:
                add_seed("departments", dept.department_id)
        if resources_bucket and resources_bucket.parameter_fields:
            for field in resources_bucket.parameter_fields:
                add_seed("parameter_fields", field.field_id)
        if resources_bucket and resources_bucket.examples:
            for example in resources_bucket.examples:
                add_seed("examples", example.id)

        # Step 3: Expand seed nodes via resource tree traversal
        async with get_db_connection() as conn:
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
                    IPersonaResourceV4(
                        resource_type=resource_type,
                        resource_ids=[uuid.UUID(rid) for rid in sorted(resource_ids)],
                    )
                    for resource_type, resource_ids in resources_by_type.items()
                ]

            # Get group_id from the single top-level group ID
            existing_group_id = result.group_id

            # Step 4: Fetch context and validate prerequisites
            context_params = GetPersonaGenerationContextSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
            )
            context_row = cast(
                GetPersonaGenerationContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params),
            )

            # Build context dataclass for validation
            ctx = GenerationContext(
                agent_exists=context_row.agent_exists or False,
                agent_name=context_row.agent_name,
                agent_is_active=context_row.agent_is_active or False,
                model_id=context_row.model_id,
                model_name=context_row.model_name,
                provider_id=context_row.provider_id,
                provider_name=context_row.provider_name,
                has_api_key=context_row.has_api_key or False,
                requests_per_day=context_row.requests_per_day,
                runs_today=context_row.runs_today or 0,
            )

            # Validate using business logic in Python
            is_valid, failures = validate_generation_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Persona generation validation failed - "
                    f"profile_id={profile_id}, agent_id={agent_id}, "
                    f"reason: {error_msg}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to prepare persona generation: {error_msg}",
                        artifact_type="persona",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="persona",
                    ),
                    sid=sid,
                )
                return

            # Build current resources from draft-backed websocket response
            current_resources: list[IPersonaResourceV4] = []
            current_bucket = result.resources.current if result.resources else None

            if current_bucket:
                _id_extractors: list[tuple[str, list | None, str]] = [
                    ("names", current_bucket.names, "id"),
                    ("descriptions", current_bucket.descriptions, "id"),
                    ("colors", current_bucket.colors, "id"),
                    ("icons", current_bucket.icons, "id"),
                    ("instructions", current_bucket.instructions, "id"),
                    ("flags", current_bucket.flags, "flag_option_id"),
                    ("departments", current_bucket.departments, "department_id"),
                    ("parameter_fields", current_bucket.parameter_fields, "field_id"),
                    ("examples", current_bucket.examples, "id"),
                    ("parameters", current_bucket.parameters, "parameter_id"),
                ]
                for resource_type, items, id_field in _id_extractors:
                    if items:
                        ids = [
                            getattr(item, id_field)
                            for item in items
                            if getattr(item, id_field, None) is not None
                        ]
                        if ids:
                            current_resources.append(
                                IPersonaResourceV4(
                                    resource_type=resource_type,
                                    resource_ids=ids,
                                )
                            )

            # Step 5: Prepare generation (group/run creation, context fetch)
            prepare_params = PreparePersonaGenerationSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
                p_group_id=existing_group_id,
                p_resources=resources if resources else None,
                p_current_resources=current_resources if current_resources else None,
                p_resource_types=resource_types,  # For tool filtering
            )
            prepare_row = cast(
                PreparePersonaGenerationSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row.run_id:
                logger.error(
                    f"Persona generation preparation failed unexpectedly - "
                    f"profile_id={profile_id}, agent_id={agent_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare persona generation: Unknown error",
                        artifact_type="persona",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="persona",
                    ),
                    sid=sid,
                )
                return

            # Extract context from prepare result
            run_id = prepare_row.run_id
            group_id = prepare_row.group_id
            trace_id = prepare_row.trace_id
            system_prompt = prepare_row.system_prompt
            model_name = prepare_row.model_name
            provider_name = prepare_row.provider_name
            base_url = prepare_row.base_url
            api_key = prepare_row.api_key
            temperature = prepare_row.temperature
            reasoning = prepare_row.reasoning
            voice = prepare_row.voice
            quality = prepare_row.quality
            tools = prepare_row.tools
            developer_instruction_templates = (
                prepare_row.developer_instruction_templates
            )
            jinja_context = persona_jinja_context

            # Inject config view into Jinja context for template access
            jinja_context["views"] = {
                "config": {
                    "config_id": str(prepare_row.config_id)
                    if prepare_row.config_id
                    else None,
                    "model_name": model_name,
                    "provider_name": provider_name,
                    "temperature": temperature,
                    "reasoning": reasoning,
                    "voice": voice,
                    "quality": quality,
                },
            }

            # Step 5: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 6: Build messages for LLM AND persist to database
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

            # Insert system prompt
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
                await conn.fetchval(
                    create_message_sql,
                    run_id,
                    "system",
                    system_prompt,
                    True,
                    False,
                )

            # Insert developer instructions
            for m in rendered_developer_messages:
                messages.append({"role": "developer", "content": m})
                await conn.fetchval(
                    create_message_sql,
                    run_id,
                    "developer",
                    m,
                    True,
                    False,
                )

            # Insert user instructions
            if data.user_instructions:
                for instruction in data.user_instructions:
                    messages.append({"role": "user", "content": instruction})
                    await conn.fetchval(
                        create_message_sql,
                        run_id,
                        "user",
                        instruction,
                        True,
                        False,
                    )

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
                    "message_id": None,
                    "messages": messages,
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
                        "tool_choice": "required",  # Force tool calls for persona generation
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
