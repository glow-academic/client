"""Auth generation router - unified handler for all auth resource types.

This module handles all business logic for auth generation:
- Rate limit validation (fail fast)
- Group/run creation
- Agent/model context fetching
- Jinja template rendering for developer instructions
- Message insertion with deduplication

The AI handler (generate.py) receives a simplified payload with pre-rendered content.

Note: Reuses persona generation context/prepare SQL since the agent/model/provider
lookup logic is identical across all artifact types.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.auth.get import get_auth_websocket
from app.api.v4.artifacts.auth.types import (
    AuthResourceBucket,
    GetAuthWebsocketResponse,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.auth.permissions import (
    GenerationContext,
    format_generation_error,
    validate_generation_access,
)
from app.socket.v4.artifacts.auth.types import GenerateAuthPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetPersonaGenerationContextSqlParams,
    GetPersonaGenerationContextSqlRow,
    IPersonaResourceV4,
    PreparePersonaGenerationSqlParams,
    PreparePersonaGenerationSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths - reuse persona generation SQL (agent/model/provider lookup is identical)
SQL_PATH_CONTEXT = (
    "app/sql/v4/queries/generate/persona/get_persona_generation_context_complete.sql"
)
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/persona/prepare_persona_generation_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)

# Auth resource types
AUTH_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "protocols",
    "slugs",
]


def _build_auth_jinja_context(
    response: GetAuthWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from auth websocket response."""
    if response.resources and response.resources.resources:
        resources = response.resources.resources.model_dump()
        current = (
            response.resources.current.model_dump()
            if response.resources.current
            else AuthResourceBucket().model_dump()
        )
        resources["current"] = current
        return resources
    return {"current": AuthResourceBucket().model_dump()}


async def _auth_generate_impl(
    sid: str, data: GenerateAuthPayload, profile_id: uuid.UUID
) -> None:
    """Handle auth generation with all business logic.

    This function:
    1. Validates domain_ids and derives resource_types + agent_id
    2. Fetches auth data via internal function for seed nodes
    3. Calls prepare generation SQL (rate limit, group/run, context)
    4. Renders developer instructions with Jinja
    5. Inserts pre-rendered messages
    6. Emits simplified payload to generate_artifact handler
    """
    try:
        # Validate domain_ids
        if not data.domain_ids:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="domain_ids must be provided",
                    artifact_type="auth",
                    group_id=None,
                    resource_type="auth",
                ),
                sid=sid,
            )
            return

        if not data.draft_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Draft ID is required for auth generation",
                    artifact_type="auth",
                    group_id=None,
                    resource_type="auth",
                ),
                sid=sid,
            )
            return

        # Step 1: Fetch auth data for seed nodes using websocket function
        result = await get_auth_websocket(
            profile_id=profile_id,
            auth_id=data.auth_id,
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
            result.protocols_domain_id: "protocols",
            result.slugs_domain_id: "slugs",
        }
        domain_to_resource.pop(None, None)

        # Derive resource_types from domain_ids
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
                    artifact_type="auth",
                    group_id=None,
                    resource_type="auth",
                ),
                sid=sid,
            )
            return

        invalid_types = [rt for rt in resource_types if rt not in AUTH_RESOURCE_TYPES]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="auth",
                    group_id=None,
                    resource_type="auth",
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
                    artifact_type="auth",
                    group_id=None,
                    resource_type="auth",
                ),
                sid=sid,
            )
            return

        auth_jinja_context = _build_auth_jinja_context(result, resource_types)

        # Step 2: Build seed resources from auth data
        resources: list[IPersonaResourceV4] = []
        resources_bucket = result.resources.resources if result.resources else None

        if resources_bucket:
            resource_map: dict[str, list[uuid.UUID]] = {}
            if resources_bucket.names:
                for name in resources_bucket.names:
                    if name.id and "names" in resource_types:
                        resource_map.setdefault("names", []).append(name.id)
            if resources_bucket.descriptions:
                for desc in resources_bucket.descriptions:
                    if desc.id and "descriptions" in resource_types:
                        resource_map.setdefault("descriptions", []).append(desc.id)
            if resources_bucket.flags:
                for flag in resources_bucket.flags:
                    if flag.flag_option_id and "flags" in resource_types:
                        resource_map.setdefault("flags", []).append(flag.flag_option_id)
            if resources_bucket.protocols:
                for protocol in resources_bucket.protocols:
                    if protocol.id and "protocols" in resource_types:
                        resource_map.setdefault("protocols", []).append(protocol.id)
            if resources_bucket.slugs:
                for slug in resources_bucket.slugs:
                    if slug.id and "slugs" in resource_types:
                        resource_map.setdefault("slugs", []).append(slug.id)

            resources = [
                IPersonaResourceV4(
                    resource_type=rt,
                    resource_ids=rids,
                )
                for rt, rids in resource_map.items()
            ]

        existing_group_id: uuid.UUID | None = result.group_id

        async with get_db_connection() as conn:
            # Step 3: Fetch context and validate prerequisites
            context_params = GetPersonaGenerationContextSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
            )
            context_row = cast(
                GetPersonaGenerationContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params),
            )

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

            is_valid, failures = validate_generation_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Auth generation validation failed - "
                    f"profile_id={profile_id}, agent_id={agent_id}, "
                    f"reason: {error_msg}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to prepare auth generation: {error_msg}",
                        artifact_type="auth",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="auth",
                    ),
                    sid=sid,
                )
                return

            # Build current resources from form state
            current_resources: list[IPersonaResourceV4] = []

            # Auth doesn't have form state fields in the generate payload
            # (unlike persona which passes name_id, description_id, etc.)
            # Current selections come from the websocket response

            # Step 4: Prepare generation (group/run creation, context fetch)
            prepare_params = PreparePersonaGenerationSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
                p_group_id=existing_group_id,
                p_resources=resources if resources else None,
                p_current_resources=current_resources if current_resources else None,
                p_resource_types=resource_types,
            )
            prepare_row = cast(
                PreparePersonaGenerationSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row.run_id:
                logger.error(
                    f"Auth generation preparation failed unexpectedly - "
                    f"profile_id={profile_id}, agent_id={agent_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare auth generation: Unknown error",
                        artifact_type="auth",
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="auth",
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
            jinja_context = auth_jinja_context

            # Step 5: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 6: Build messages for LLM AND persist to database
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

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
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "auth",
                    "resource_type": resource_types[0] if resource_types else "auth",
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
                        "tool_choice": "required",
                    },
                    "tools": convert_tools_to_dict(tools),
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        logger.exception(f"Failed to generate auth resources: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate auth resources: {str(e)}",
                artifact_type="auth",
                group_id=None,
                resource_type="auth",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def auth_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle auth_generate event (client-to-server)."""
    try:
        payload = GenerateAuthPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="auth",
                    group_id=None,
                    resource_type="auth",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _auth_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="auth",
                group_id=None,
                resource_type="auth",
            ),
            sid=sid,
        )


@internal_sio.on("auth_generate")  # type: ignore
async def auth_generate_internal(data: dict[str, Any]) -> None:
    """Handle auth_generate event from internal bus (server-to-server)."""
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
                    artifact_type="auth",
                    group_id=None,
                    resource_type="auth",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateAuthPayload(**data)
        await _auth_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="auth",
                group_id=None,
                resource_type="auth",
            ),
            sid=sid,
        )
