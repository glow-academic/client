"""Parameter generation router - unified handler for all parameter resource types.

This module handles all business logic for parameter generation:
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

from app.api.v4.artifacts.parameter.get import get_parameter_websocket
from app.api.v4.artifacts.parameter.types import (
    GetParameterWebsocketResponse,
    ParameterResourceBucket,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.parameter.permissions import (
    GenerationContext,
    format_generation_error,
    validate_generation_access,
)
from app.socket.v4.artifacts.parameter.types import GenerateParameterPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetParameterGenerationContextSqlParams,
    GetParameterGenerationContextSqlRow,
    GetPersonaResourceTreeSqlParams,
    GetPersonaResourceTreeSqlRow,
    IPersonaResourceV4,
    PrepareParameterGenerationSqlParams,
    PrepareParameterGenerationSqlRow,
    QGetPersonaResourceTreeV4Node,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths - reuse persona resource tree (generic traversal)
RESOURCE_TREE_SQL_PATH = (
    "app/sql/v4/queries/personas/get_persona_resource_tree_complete.sql"
)
# Parameter-specific generation SQL
SQL_PATH_CONTEXT = "app/sql/v4/queries/generate/parameter/get_parameter_generation_context_complete.sql"
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/parameter/prepare_parameter_generation_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)

# Parameter resource types
PARAMETER_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "fields",
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


def _build_parameter_jinja_context(
    response: GetParameterWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from parameter websocket response."""

    if response.resources and response.resources.resources:
        resources = response.resources.resources.model_dump()
        current = (
            response.resources.current.model_dump()
            if response.resources.current
            else ParameterResourceBucket().model_dump()
        )
        resources["current"] = current
        return resources
    return {"current": ParameterResourceBucket().model_dump()}


async def _parameter_generate_impl(
    sid: str, data: GenerateParameterPayload, profile_id: uuid.UUID
) -> None:
    """Handle parameter generation with all business logic.

    This function:
    1. Validates domain_ids and derives resource_types + agent_id
    2. Fetches parameter data via internal function for seed nodes
    3. Expands resources via tree traversal
    4. Calls prepare_parameter_generation SQL (rate limit, group/run, context)
    5. Renders developer instructions with Jinja
    6. Inserts pre-rendered messages
    7. Emits simplified payload to generate_artifact handler
    """
    try:
        # Validate domain_ids
        if not data.domain_ids:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="domain_ids must be provided",
                    artifact_type="parameter",
                    group_id=None,
                    resource_type="parameter",
                ),
                sid=sid,
            )
            return

        if not data.draft_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Draft ID is required for parameter generation",
                    artifact_type="parameter",
                    group_id=None,
                    resource_type="parameter",
                ),
                sid=sid,
            )
            return

        # Step 1: Fetch parameter data for seed nodes using websocket function
        # This gives us the domains mapping to look up agent_ids
        result = await get_parameter_websocket(
            profile_id=profile_id,
            parameter_id=data.parameter_id,
            draft_id=data.draft_id,
        )

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping from result
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.name_domain_id: "names",
            result.description_domain_id: "descriptions",
            result.flag_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.fields_domain_id: "fields",
        }
        # Remove None key if present
        domain_to_resource.pop(None, None)

        # Derive resource_types from domain_ids (internal use only)
        resource_types: list[str] = []
        for did in data.domain_ids:
            if did in domain_to_resource:
                resource_types.append(domain_to_resource[did])

        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No valid domain_ids provided",
                    artifact_type="parameter",
                    group_id=None,
                    resource_type="parameter",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in resource_types if rt not in PARAMETER_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="parameter",
                    group_id=None,
                    resource_type="parameter",
                ),
                sid=sid,
            )
            return

        # Get agent_id from the first valid domain_id
        agent_id: uuid.UUID | None = None
        for did in data.domain_ids:
            if did in domain_to_agent and domain_to_agent[did] is not None:
                agent_id = domain_to_agent[did]
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested domains",
                    artifact_type="parameter",
                    group_id=None,
                    resource_type="parameter",
                ),
                sid=sid,
            )
            return

        parameter_jinja_context = _build_parameter_jinja_context(result, resource_types)

        # Step 2: Seed resource nodes from the parameter GET result (ONLY requested types)
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
        if resources_bucket and resources_bucket.flags:
            for flag in resources_bucket.flags:
                add_seed("flags", flag.flag_option_id)
        if resources_bucket and resources_bucket.departments:
            for dept in resources_bucket.departments:
                add_seed("departments", dept.department_id)
        if resources_bucket and resources_bucket.fields:
            for field in resources_bucket.fields:
                add_seed("fields", field.field_id)

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

            # Get group_id from parameter response if available
            existing_group_id: uuid.UUID | None = result.group_id

            # Step 4: Fetch context and validate prerequisites
            context_params = GetParameterGenerationContextSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
            )
            context_row = cast(
                GetParameterGenerationContextSqlRow,
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
                    f"Parameter generation validation failed - "
                    f"profile_id={profile_id}, agent_id={agent_id}, "
                    f"reason: {error_msg}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to prepare parameter generation: {error_msg}",
                        artifact_type="parameter",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="parameter",
                    ),
                    sid=sid,
                )
                return

            # Build current resources from form state (passed from frontend)
            current_resources: list[IPersonaResourceV4] = []

            def collect_current(
                resource_type: str, resource_ids: list[uuid.UUID] | None
            ) -> None:
                """Collect current resource IDs for a resource type."""
                if resource_ids:
                    current_resources.append(
                        IPersonaResourceV4(
                            resource_type=resource_type,
                            resource_ids=resource_ids,
                        )
                    )

            # Single-select resources (wrap in list)
            if data.parameter_id:
                # For parameter, current selections come from the draft
                # The websocket response already includes current resources
                pass

            # Step 5: Prepare generation (group/run creation, context fetch)
            prepare_params = PrepareParameterGenerationSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
                p_group_id=existing_group_id,
                p_resources=resources if resources else None,
                p_current_resources=current_resources if current_resources else None,
                p_resource_types=resource_types,  # For tool filtering
            )
            prepare_row = cast(
                PrepareParameterGenerationSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row.run_id:
                logger.error(
                    f"Parameter generation preparation failed unexpectedly - "
                    f"profile_id={profile_id}, agent_id={agent_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare parameter generation: Unknown error",
                        artifact_type="parameter",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="parameter",
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
            jinja_context = parameter_jinja_context

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
                    "artifact_type": "parameter",
                    "resource_type": resource_types[0]
                    if resource_types
                    else "parameter",
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
                        "tool_choice": "required",  # Force tool calls for parameter generation
                    },
                    "tools": convert_tools_to_dict(tools),
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        logger.exception(f"Failed to generate parameter resources: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate parameter resources: {str(e)}",
                artifact_type="parameter",
                group_id=None,
                resource_type="parameter",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def parameter_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle parameter_generate event (client-to-server)."""
    try:
        payload = GenerateParameterPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="parameter",
                    group_id=None,
                    resource_type="parameter",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _parameter_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="parameter",
                group_id=None,
                resource_type="parameter",
            ),
            sid=sid,
        )


@internal_sio.on("parameter_generate")  # type: ignore
async def parameter_generate_internal(data: dict[str, Any]) -> None:
    """Handle parameter_generate event from internal bus (server-to-server)."""
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
                    artifact_type="parameter",
                    group_id=None,
                    resource_type="parameter",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateParameterPayload(**data)
        await _parameter_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="parameter",
                group_id=None,
                resource_type="parameter",
            ),
            sid=sid,
        )
