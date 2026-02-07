"""Cohort generation router - unified handler for all cohort resource types.

Uses domain-based generation pattern (matching persona gold standard):
1. Validates domain_ids from client
2. Fetches cohort data via get_cohort_websocket() (not monolithic SQL)
3. Derives resource_types + agent_id from domain_ids
4. Builds Jinja context from resources bucket
5. Creates run + renders messages + emits generate_artifact
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.cohort.get import get_cohort_websocket
from app.api.v4.artifacts.cohort.types import (
    GetCohortApiRequest,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

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

    # Domain-based API (new)
    domain_ids: list[uuid.UUID] | None = None
    # Legacy fields (backward compat)
    agent_type: str | None = None
    resource_types: list[str] | None = None
    # Optional user instructions
    user_instructions: list[str] | None = None


async def _cohort_generate_impl(
    sid: str, data: GenerateCohortPayload, profile_id: uuid.UUID
) -> None:
    """Handle cohort generation - supports both domain-based (new) and agent_type (legacy) modes."""
    try:
        error_resource_type: str | None = None

        # Step 1: Fetch cohort data via websocket function
        result = await get_cohort_websocket(
            profile_id=profile_id,
            cohort_id=data.cohort_id,
            draft_id=data.draft_id,
        )

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping from result
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.names_domain_id: "names",
            result.descriptions_domain_id: "descriptions",
            result.flags_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.simulations_domain_id: "simulations",
            result.simulation_positions_domain_id: "simulation_positions",
        }
        # Remove None key if present
        domain_to_resource.pop(None, None)

        # Determine resource_types and agent_id
        resource_types: list[str] = []
        agent_id: uuid.UUID | None = None

        if data.domain_ids:
            # === Domain-based mode (new) ===
            for did in data.domain_ids:
                if did in domain_to_resource:
                    resource_types.append(domain_to_resource[did])

            if not resource_types:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="No valid domain_ids provided",
                        artifact_type="cohort",
                        group_id=None,
                        resource_type=None,
                    ),
                    sid=sid,
                )
                return

            # Get agent_id from the first valid domain_id
            for did in data.domain_ids:
                if did in domain_to_agent and domain_to_agent[did] is not None:
                    agent_id = domain_to_agent[did]
                    break

        elif data.resource_types and data.agent_type:
            # === Legacy mode (backward compat) ===
            resource_types = data.resource_types

            # Build agent_type -> agent_id mapping from domains
            # Find the agent associated with the first resource type
            resource_to_domain: dict[str, uuid.UUID | None] = {
                v: k for k, v in domain_to_resource.items()
            }
            for rt in resource_types:
                domain_id = resource_to_domain.get(rt)
                if domain_id and domain_id in domain_to_agent:
                    agent_id = domain_to_agent[domain_id]
                    if agent_id:
                        break

        else:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Either domain_ids or (resource_types + agent_type) must be provided",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type=None,
                ),
                sid=sid,
            )
            return

        error_resource_type = resource_types[0] if resource_types else None

        # Validate resource types
        invalid_types = [rt for rt in resource_types if rt not in COHORT_RESOURCE_TYPES]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type=error_resource_type,
                    resource_types=resource_types,
                ),
                sid=sid,
            )
            return

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested domains",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type=error_resource_type,
                    resource_types=resource_types,
                ),
                sid=sid,
            )
            return

        # Build resources array for SQL
        resources: list[dict[str, Any]] = []
        resources_bucket = result.resources.resources if result.resources else None

        if resources_bucket and resources_bucket.names:
            resources.append(
                {
                    "resource_type": "names",
                    "resource_ids": [str(n.id) for n in resources_bucket.names if n.id],
                }
            )
        if resources_bucket and resources_bucket.descriptions:
            resources.append(
                {
                    "resource_type": "descriptions",
                    "resource_ids": [
                        str(d.id) for d in resources_bucket.descriptions if d.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.flags:
            resources.append(
                {
                    "resource_type": "flags",
                    "resource_ids": [str(f.id) for f in resources_bucket.flags if f.id],
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
        if resources_bucket and resources_bucket.simulations:
            resources.append(
                {
                    "resource_type": "simulations",
                    "resource_ids": [
                        str(s.simulation_id)
                        for s in resources_bucket.simulations
                        if s.simulation_id
                    ],
                }
            )
        if resources_bucket and resources_bucket.simulation_positions:
            resources.append(
                {
                    "resource_type": "simulation_positions",
                    "resource_ids": [
                        f"{sp.simulation_id}-{sp.value}"
                        for sp in resources_bucket.simulation_positions
                        if sp.simulation_id is not None and sp.value is not None
                    ],
                }
            )

        group_id: uuid.UUID | None = result.group_id

        resources_sql = normalize_resources_for_sql(resources)

        async with get_db_connection() as conn:
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
                        artifact_type="cohort",
                        group_id=str(group_id) if group_id else None,
                        resource_type=error_resource_type,
                        resource_types=resource_types,
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
                        artifact_type="cohort",
                        group_id=str(group_id) if group_id else None,
                        resource_type=error_resource_type,
                        resource_types=resource_types,
                    ),
                    sid=sid,
                )
                return

            rendered_developer_messages = render_developer_instructions(
                templates=run_context_row.get("developer_instruction_templates"),
                jinja_context=run_context_row.get("context"),
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

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "cohort",
                    "resource_type": resource_types[0] if resource_types else "cohort",
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
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate cohort resources: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type=error_resource_type,
                resource_types=resource_types if "resource_types" in dir() else None,
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def cohort_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle cohort_generate event (client-to-server)."""
    try:
        payload = GenerateCohortPayload(**data)
        error_resource_type = None
        if payload.resource_types:
            error_resource_type = (
                payload.resource_types[0] if payload.resource_types else None
            )
        elif payload.domain_ids:
            error_resource_type = "cohort"

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type=error_resource_type,
                    resource_types=payload.resource_types,
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _cohort_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type=None,
                resource_types=None,
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
            resource_types = data.get("resource_types") or []
            error_resource_type = resource_types[0] if resource_types else None
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type=error_resource_type,
                    resource_types=resource_types,
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateCohortPayload(**data)
        await _cohort_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type=None,
                resource_types=None,
            ),
            sid=sid,
        )
