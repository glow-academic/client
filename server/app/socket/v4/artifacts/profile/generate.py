"""Profile generation router - unified handler for all profile resource types."""

import uuid
from typing import Any, cast

from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (GetProfileApiRequest, GetProfileSqlParams,
                           GetProfileSqlRow)
from fastapi import APIRouter
from app.utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/profile/get_profile_complete.sql"
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


class GenerateProfilePayload(GetProfileApiRequest):
    """Request to generate profile resources - extends GET API request with generation-specific fields."""

    agent_type: str | None = None  # Optional: "name", "flags", "departments", "emails", "request_limits", "cohorts"
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions
    staff_id: str | None = None  # Client passes staff_id instead of target_profile_id


def _build_agent_type_map(
    result: GetProfileSqlRow,
) -> dict[str, uuid.UUID | None]:
    """Build agent_type -> agent_id mapping for profile generation."""
    return {
        "name": result.name_agent_id,
        "flags": result.flag_agent_id,
        "departments": result.departments_agent_id,
        "emails": result.emails_agent_id,
        "request_limits": result.request_limit_agent_id,
        "cohorts": result.cohorts_agent_id,
        "basic": result.basic_agent_id,
        "general": result.general_agent_id,
        "all": result.general_agent_id,
    }


async def _profile_generate_impl(
    sid: str, data: GenerateProfilePayload, profile_id: uuid.UUID
) -> None:
    """Handle profile generation - emit generate_artifact with all resource types."""
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
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

        # Call get_profile_v4 SQL function (same as GET API endpoint)
        async with get_db_connection() as conn:
            target_profile_id = data.target_profile_id or data.staff_id
            params = GetProfileSqlParams(
                profile_id=profile_id,
                target_profile_id=uuid.UUID(target_profile_id)
                if target_profile_id
                else None,
                draft_id=data.draft_id,
            )

            result = cast(
                GetProfileSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            agent_type_map = _build_agent_type_map(result)
            agent_id = agent_type_map.get(data.agent_type or "")

            # Extract resource IDs from arrays and build resources array (composite type format)
            resources: list[dict[str, Any]] = []

            if result.names:
                resources.append({
                    "resource_type": "names",
                    "resource_ids": [str(n.id) for n in result.names if n.id]
                })
            if result.emails:
                resources.append({
                    "resource_type": "emails",
                    "resource_ids": [str(e.id) for e in result.emails if e.id]
                })
            if result.request_limits:
                resources.append({
                    "resource_type": "request_limits",
                    "resource_ids": [str(r.id) for r in result.request_limits if r.id]
                })
            if result.departments:
                resources.append({
                    "resource_type": "departments",
                    "resource_ids": [str(d.department_id) for d in result.departments if d.department_id]
                })
            if result.cohorts:
                resources.append({
                    "resource_type": "cohorts",
                    "resource_ids": [str(c.cohort_id) for c in result.cohorts if c.cohort_id]
                })
            if result.routes:
                resources.append({
                    "resource_type": "routes",
                    "resource_ids": [str(r.route_id) for r in result.routes if r.route_id]
                })
            if result.flag_resource and result.flag_resource.id:
                resources.append({
                    "resource_type": "flags",
                    "resource_ids": [str(result.flag_resource.id)]
                })

            group_id: uuid.UUID | None = result.group_id

            if agent_id:
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
                    create_run_row["group_id"]
                    if create_run_row["group_id"]
                    else group_id
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
                        "artifact_type": "profile",
                        "resource_type": resource_types[0]
                        if resource_types
                        else "profile",
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
                return

            # Fallback: emit per-resource using each resource's agent_id
            for resource_type in resource_types:
                per_resource_agent_id = agent_type_map.get(resource_type)
                if not per_resource_agent_id:
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"No agent found for resource_type: {resource_type}",
                            artifact_type="profile",
                            group_id=str(group_id) if group_id else None,
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )
                    continue
                per_resources = [r for r in resources if r.get("resource_type") == resource_type]
                per_resources_sql = normalize_resources_for_sql(per_resources)
                create_run_sql = load_sql(CREATE_RUN_SQL_PATH)
                create_run_row = await conn.fetchrow(
                    create_run_sql,
                    per_resource_agent_id,
                    profile_id,
                    None,
                    None,
                    group_id,
                    None,
                    data.user_instructions if data.user_instructions else None,
                    per_resources_sql,
                )

                if not create_run_row:
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="Failed to create generation run",
                            artifact_type="profile",
                            group_id=str(group_id) if group_id else None,
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )
                    continue

                run_id = str(create_run_row["run_id"])
                group_id = (
                    create_run_row["group_id"]
                    if create_run_row["group_id"]
                    else group_id
                )
                trace_id = create_run_row.get("trace_id")
                message_ids = create_run_row.get("message_ids")

                run_context_sql = load_sql(TEXT_RUN_CONTEXT_SQL_PATH)
                run_context_row = await conn.fetchrow(
                    run_context_sql,
                    uuid.UUID(run_id),
                    per_resource_agent_id,
                    message_ids,
                    group_id,
                    per_resources_sql,
                )

                if not run_context_row:
                    await emit_to_internal(
                        "generate_call_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="Failed to load generation context",
                            artifact_type="profile",
                            group_id=str(group_id) if group_id else None,
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )
                    continue

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
                        "artifact_type": "profile",
                        "resource_type": resource_type,
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
