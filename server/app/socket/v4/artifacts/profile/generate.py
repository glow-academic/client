"""Profile generation router - unified handler for all profile resource types.

Uses the three-layer architecture: calls get_profile_websocket() for data,
then uses domain-based agent lookup for generation context.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.profile.get import get_profile_websocket
from app.api.v4.artifacts.profile.types import (
    GetProfileWebsocketResponse,
    ProfileResourceBucket,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.profile.permissions import (
    GenerationContext,
    format_generation_error,
    validate_generation_access,
)
from app.socket.v4.artifacts.profile.types import GenerateProfilePayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetPersonaGenerationContextSqlParams,
    GetPersonaGenerationContextSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths — reuse persona generation context (shared agent/model/rate-limit check)
SQL_PATH_CONTEXT = (
    "app/sql/v4/queries/generate/persona/get_persona_generation_context_complete.sql"
)
CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

# Profile resource types
PROFILE_RESOURCE_TYPES = [
    "names",
    "flags",
    "request_limits",
    "departments",
    "emails",
    "cohorts",
]


def _build_profile_jinja_context(
    response: GetProfileWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from profile websocket response."""

    if response.resources and response.resources.resources:
        resources = response.resources.resources.model_dump()
        current = (
            response.resources.current.model_dump()
            if response.resources.current
            else ProfileResourceBucket().model_dump()
        )
        resources["current"] = current
        return resources
    return {"current": ProfileResourceBucket().model_dump()}


async def _profile_generate_impl(
    sid: str, data: GenerateProfilePayload, profile_id: uuid.UUID
) -> None:
    """Handle profile generation with domain-based agent lookup.

    This function:
    1. Validates domain_ids and derives resource_types + agent_id
    2. Fetches profile data via get_profile_websocket() for agent lookup
    3. Validates generation prerequisites (agent, model, rate limit)
    4. Creates run and fetches context
    5. Renders developer instructions with Jinja
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
                    artifact_type="profile",
                    group_id=None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        # Step 1: Fetch profile data for domain-to-agent mapping
        target_profile_id = data.target_profile_id
        if not target_profile_id and data.staff_id:
            target_profile_id = uuid.UUID(data.staff_id)

        result = await get_profile_websocket(
            profile_id=profile_id,
            target_profile_id=target_profile_id,
            draft_id=data.draft_id,
        )

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.name_domain_id: "names",
            result.emails_domain_id: "emails",
            result.request_limits_domain_id: "request_limits",
            result.flag_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.cohorts_domain_id: "cohorts",
        }
        # Remove None key if present
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
                "generate_call_error",
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
                    artifact_type="profile",
                    group_id=None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        profile_jinja_context = _build_profile_jinja_context(result, resource_types)

        # Build resources list from websocket response
        resources: list[dict[str, Any]] = []
        resources_bucket = result.resources.resources if result.resources else None

        if resources_bucket and resources_bucket.names:
            resources.append(
                {
                    "resource_type": "names",
                    "resource_ids": [str(n.id) for n in resources_bucket.names if n.id],
                }
            )
        if resources_bucket and resources_bucket.emails:
            resources.append(
                {
                    "resource_type": "emails",
                    "resource_ids": [
                        str(e.id) for e in resources_bucket.emails if e.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.request_limits:
            resources.append(
                {
                    "resource_type": "request_limits",
                    "resource_ids": [
                        str(r.id) for r in resources_bucket.request_limits if r.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.departments:
            resources.append(
                {
                    "resource_type": "departments",
                    "resource_ids": [
                        str(d.department_id)
                        for d in resources_bucket.departments
                        if d.department_id
                    ],
                }
            )
        if resources_bucket and resources_bucket.cohorts:
            resources.append(
                {
                    "resource_type": "cohorts",
                    "resource_ids": [
                        str(c.cohort_id)
                        for c in resources_bucket.cohorts
                        if c.cohort_id
                    ],
                }
            )
        if resources_bucket and resources_bucket.flags:
            flag_ids = [
                str(f.flag_option_id)
                for f in resources_bucket.flags
                if f.flag_option_id
            ]
            if flag_ids:
                resources.append(
                    {
                        "resource_type": "flags",
                        "resource_ids": flag_ids,
                    }
                )

        group_id: uuid.UUID | None = result.group_id

        # Step 2: Validate generation prerequisites
        async with get_db_connection() as conn:
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
                    f"Profile generation validation failed - "
                    f"profile_id={profile_id}, agent_id={agent_id}, "
                    f"reason: {error_msg}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to prepare profile generation: {error_msg}",
                        artifact_type="profile",
                        group_id=str(group_id) if group_id else None,
                        resource_type="profile",
                    ),
                    sid=sid,
                )
                return

            # Step 3: Create run and fetch context
            resources_sql = normalize_resources_for_sql(resources)
            create_run_sql = load_sql(CREATE_RUN_SQL_PATH)
            create_run_row = await conn.fetchrow(
                create_run_sql,
                agent_id,
                profile_id,
                None,
                None,
                group_id,
                None,
                data.user_instructions if data.user_instructions else None,
                resources_sql,
            )

            if not create_run_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create generation run",
                        artifact_type="profile",
                        group_id=str(group_id) if group_id else None,
                        resource_type="profile",
                    ),
                    sid=sid,
                )
                return

            run_id = str(create_run_row["run_id"])
            group_id = (
                create_run_row["group_id"] if create_run_row["group_id"] else group_id
            )
            trace_id = create_run_row.get("trace_id")
            message_ids = create_run_row.get("message_ids")

            run_context_sql = load_sql(TEXT_RUN_CONTEXT_SQL_PATH)
            run_context_row = await conn.fetchrow(
                run_context_sql,
                uuid.UUID(run_id),
                agent_id,
                message_ids,
                group_id,
                resources_sql,
            )

            if not run_context_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to load generation context",
                        artifact_type="profile",
                        group_id=str(group_id) if group_id else None,
                        resource_type="profile",
                    ),
                    sid=sid,
                )
                return

            # Step 4: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=run_context_row.get("developer_instruction_templates"),
                jinja_context=profile_jinja_context,
            )

            messages: list[dict[str, Any]] = []
            if run_context_row.get("system_prompt"):
                messages.append(
                    {"role": "system", "content": run_context_row["system_prompt"]}
                )
            for dev_msg in rendered_developer_messages:
                messages.append({"role": "developer", "content": dev_msg})
            for user_msg in data.user_instructions or []:
                messages.append({"role": "user", "content": user_msg})

            # Step 5: Emit to generate_artifact handler
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "profile",
                    "resource_type": resource_types[0] if resource_types else "profile",
                    "run_id": run_id,
                    "group_id": str(group_id) if group_id else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": run_context_row.get("model_name"),
                        "api_key": run_context_row.get("api_key"),
                        "base_url": run_context_row.get("base_url"),
                        "temperature": run_context_row.get("temperature"),
                        "reasoning": run_context_row.get("reasoning"),
                        "provider": run_context_row.get("provider"),
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                    "tools": convert_tools_to_dict(run_context_row.get("tools")),
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        logger.exception(f"Failed to generate profile resources: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
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
                "generate_call_error",
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
            "generate_call_error",
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
                "generate_call_error",
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
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="profile",
                group_id=None,
                resource_type="profile",
            ),
            sid=sid,
        )
