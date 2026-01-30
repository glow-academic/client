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

from app.api.v4.artifacts.persona.get import get_persona_internal
from app.api.v4.artifacts.persona.types import GetPersonaApiRequest
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetPersonaResourceTreeSqlParams,
    GetPersonaResourceTreeSqlRow,
    IPersonaResourceV4,
    InsertGenerationMessagesSqlParams,
    InsertGenerationMessagesSqlRow,
    PreparePersonaGenerationSqlParams,
    PreparePersonaGenerationSqlRow,
    QGetPersonaResourceTreeV4Node,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

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
    "parameter_fields",
    "departments",
]


class GeneratePersonaPayload(GetPersonaApiRequest):
    """Request to generate persona resources - extends GET API request with generation-specific fields."""

    agent_id: uuid.UUID  # Required: explicit agent ID from frontend
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


async def _persona_generate_impl(
    sid: str, data: GeneratePersonaPayload, profile_id: uuid.UUID
) -> None:
    """Handle persona generation with all business logic.

    This function:
    1. Validates resource types
    2. Fetches persona data via internal function for seed nodes
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

        # Use agent_id directly from payload (frontend provides it)
        agent_id = data.agent_id

        # Step 1: Fetch persona data for seed nodes using internal function
        result = await get_persona_internal(
            profile_id=profile_id,
            persona_id=data.persona_id,
            draft_id=data.draft_id,
        )

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
                add_seed("flags", flag.flag_option_id)
        if result.departments:
            for dept in result.departments:
                add_seed("departments", dept.department_id)
        if result.parameter_fields:
            for field in result.parameter_fields:
                add_seed("parameter_fields", field.field_id)
        if result.examples:
            for example in result.examples:
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

            # Get group_id from persona response if available
            existing_group_id: uuid.UUID | None = result.group_id

            # Step 4: Prepare generation (rate limit, group/run, context)
            # This SQL function handles rate limit validation (fail fast),
            # group/run creation, and fetches all context in one call
            try:
                prepare_params = PreparePersonaGenerationSqlParams(
                    p_profile_id=profile_id,
                    p_agent_id=agent_id,
                    p_group_id=existing_group_id,
                    p_resources=resources if resources else None,
                )
                prepare_row = cast(
                    PreparePersonaGenerationSqlRow,
                    await execute_sql_typed(
                        conn, SQL_PATH_PREPARE, params=prepare_params
                    ),
                )

                if not prepare_row.run_id:
                    # Run diagnostic queries to determine the actual failure reason
                    failure_reasons: list[str] = []

                    # Check 1: Agent exists and is active
                    agent_check = await conn.fetchrow(
                        """
                        SELECT
                            a.id,
                            EXISTS (
                                SELECT 1 FROM agent_flags_junction af
                                JOIN flags_resource f ON af.flag_id = f.id
                                WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true
                            ) as is_active
                        FROM agent_artifact a
                        WHERE a.id = $1
                        """,
                        agent_id,
                    )
                    if not agent_check:
                        failure_reasons.append(f"Agent {agent_id} does not exist")
                    elif not agent_check["is_active"]:
                        failure_reasons.append(f"Agent {agent_id} is not active")

                    # Check 2: API key configuration exists
                    key_check = await conn.fetchrow(
                        """
                        SELECT COUNT(*) as key_count
                        FROM setting_artifact s
                        JOIN setting_provider_keys_junction spk ON spk.settings_id = s.id AND spk.active = true
                        JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active = true
                        WHERE EXISTS (
                            SELECT 1 FROM setting_flags_junction sf
                            JOIN flags_resource f ON sf.flag_id = f.id
                            WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE
                        )
                        """,
                    )
                    if not key_check or key_check["key_count"] == 0:
                        failure_reasons.append("No active API key configured in settings")

                    # Check 3: Rate limit configured for profile
                    rate_check = await conn.fetchrow(
                        """
                        SELECT
                            rl.requests_per_day,
                            (
                                SELECT COUNT(*)::bigint
                                FROM profile_runs_junction prj
                                JOIN view_runs_entry mr ON mr.id = prj.run_id
                                WHERE prj.profile_id = $1
                                AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                            ) as runs_today
                        FROM profile_artifact prof
                        LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
                        LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
                        WHERE prof.id = $1
                        """,
                        profile_id,
                    )
                    if rate_check:
                        if rate_check["requests_per_day"] is None:
                            failure_reasons.append("Profile has no rate limit configured (requests_per_day is NULL)")
                        elif rate_check["runs_today"] >= rate_check["requests_per_day"]:
                            failure_reasons.append(
                                f"Rate limit exceeded ({rate_check['runs_today']}/{rate_check['requests_per_day']} requests today)"
                            )

                    # Check 4: Agent has a model configured
                    model_check = await conn.fetchrow(
                        """
                        SELECT
                            m.id as model_id,
                            (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
                            p_prov.id as provider_id,
                            (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = p_prov.id LIMIT 1) as provider_name
                        FROM agent_artifact a
                        LEFT JOIN agent_models_junction am ON am.agent_id = a.id
                        LEFT JOIN models_resource m ON m.id = am.model_id
                        LEFT JOIN model_providers_junction mp ON mp.model_id = m.id
                        LEFT JOIN providers_resource p_res ON p_res.id = mp.providers_id
                        LEFT JOIN provider_providers_junction ppj ON ppj.providers_id = p_res.id
                        LEFT JOIN provider_artifact p_prov ON p_prov.id = ppj.provider_id
                        WHERE a.id = $1
                        """,
                        agent_id,
                    )
                    if not model_check or not model_check["model_id"]:
                        failure_reasons.append(f"Agent {agent_id} has no model configured")
                    elif not model_check["provider_id"]:
                        failure_reasons.append(f"Model {model_check['model_name']} has no provider configured")

                    # Check 5: Provider has API key in active settings
                    if model_check and model_check["provider_id"]:
                        provider_key_check = await conn.fetchrow(
                            """
                            SELECT
                                spk.key_id,
                                kr.key IS NOT NULL as has_key
                            FROM setting_artifact s
                            JOIN setting_provider_keys_junction spk ON spk.settings_id = s.id AND spk.active = true
                            JOIN model_providers_junction mp ON mp.providers_id = spk.providers_id
                            JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active = true
                            WHERE mp.model_id = $1
                            AND EXISTS (
                                SELECT 1 FROM setting_flags_junction sf
                                JOIN flags_resource f ON sf.flag_id = f.id
                                WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE
                            )
                            LIMIT 1
                            """,
                            model_check["model_id"],
                        )
                        if not provider_key_check:
                            failure_reasons.append(
                                f"No API key configured for provider '{model_check['provider_name']}' in active settings"
                            )

                    error_detail = "; ".join(failure_reasons) if failure_reasons else "Unknown reason (check server logs for SQL details)"
                    logger.error(
                        f"Persona generation preparation failed - "
                        f"profile_id={profile_id}, agent_id={agent_id}, "
                        f"reason: {error_detail}"
                    )
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Failed to prepare persona generation: {error_detail}",
                            artifact_type="persona",
                            group_id=str(existing_group_id)
                            if existing_group_id
                            else None,
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
                            group_id=str(existing_group_id)
                            if existing_group_id
                            else None,
                            resource_type="persona",
                        ),
                        sid=sid,
                    )
                    return
                raise

            # Extract context from prepare result
            run_id = prepare_row.run_id
            group_id = prepare_row.group_id
            trace_id = prepare_row.trace_id
            agent_name = prepare_row.agent_name
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
            developer_instruction_templates = prepare_row.developer_instruction_templates
            jinja_context = prepare_row.jinja_context

            # Step 5: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 6: Insert pre-rendered messages
            insert_params = InsertGenerationMessagesSqlParams(
                p_run_id=run_id,
                p_developer_messages=rendered_developer_messages
                if rendered_developer_messages
                else None,
                p_user_messages=data.user_instructions
                if data.user_instructions
                else None,
            )
            insert_row = cast(
                InsertGenerationMessagesSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_INSERT_MESSAGES, params=insert_params
                ),
            )

            if not insert_row.message_id:
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

            message_id = insert_row.message_id
            messages = insert_row.messages

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
                        (
                            [{"role": "system", "content": system_prompt}]
                            if system_prompt
                            else []
                        )
                        + [
                            {"role": "developer", "content": m}
                            for m in rendered_developer_messages
                        ]
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
