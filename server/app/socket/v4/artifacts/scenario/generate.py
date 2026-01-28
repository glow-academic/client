"""Scenario generation router - unified handler for all scenario resource types."""

import uuid
from typing import Any

from app.api.v4.artifacts.scenario.get import get_scenario_generation_context
from app.api.v4.artifacts.scenario.types import GetScenarioApiRequest
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

# Scenario resource types
SCENARIO_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "problem_statements",
    "objectives",
    "scenario_flags",
    "images",
    "videos",
    "questions",
    "departments",
    "fields",
    "personas",
    "documents",
    "parameters",
    "templates",
]


class GenerateScenarioPayload(GetScenarioApiRequest):
    """Request to generate scenario resources - extends GET API request with generation-specific fields."""

    agent_type: str | None = None  # Optional: "name", "description", "basic", "content", "general"/"all"
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


async def _scenario_generate_impl(
    sid: str, data: GenerateScenarioPayload, profile_id: uuid.UUID
) -> None:
    """Handle scenario generation - emit generate_artifact for each resource type, then emit client event."""
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in resource_types if rt not in SCENARIO_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return

        # Get scenario context using internal API function (2-pass architecture)
        async with get_db_connection() as conn:
            context = await get_scenario_generation_context(
                conn=conn,
                profile_id=profile_id,
                scenario_id=data.scenario_id,
                draft_id=data.draft_id,
            )

            if context is None:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Scenario not found or access denied",
                        artifact_type="scenario",
                        group_id=None,
                        resource_type="scenario",
                    ),
                    sid=sid,
                )
                return

            # Map agent_type to agent_id from context
            agent_id: uuid.UUID | None = None
            if data.agent_type:
                agent_type_map = {
                    "name": context.name_agent_id,
                    "description": context.description_agent_id,
                    "basic": context.basic_agent_id,
                    "content": context.content_agent_id,
                    "general": context.general_agent_id,
                    "all": context.general_agent_id,
                }
                agent_id = agent_type_map.get(data.agent_type)

            if not agent_id:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"No agent found for agent_type: {data.agent_type}",
                        artifact_type="scenario",
                        group_id=str(context.group_id) if context.group_id else None,
                        resource_type="scenario",
                    ),
                    sid=sid,
                )
                return

            # Build resources array from context.resource_ids
            resources: list[dict[str, Any]] = []
            for resource_type, ids in context.resource_ids.items():
                if ids:
                    resources.append({
                        "resource_type": resource_type,
                        "resource_ids": [str(id) for id in ids]
                    })

            # Get group_id from context
            group_id: uuid.UUID | None = context.group_id
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
                        artifact_type="scenario",
                        group_id=str(group_id) if group_id else None,
                        resource_type="scenario",
                    ),
                    sid=sid,
                )
                return

            run_id = str(create_run_row["run_id"])
            group_id = create_run_row["group_id"] if create_run_row["group_id"] else group_id
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
                        artifact_type="scenario",
                        group_id=str(group_id) if group_id else None,
                        resource_type="scenario",
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

            resource_type = resource_types[0] if resource_types else "scenario"
            upload_id: str | None = None
            if resource_type in {"images", "videos"}:
                upload_id = str(uuid.uuid4())

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "scenario",
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
                    "upload_id": upload_id,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate scenario resources: {str(e)}",
                artifact_type="scenario",
                group_id=None,
                resource_type="scenario",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def scenario_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle scenario_generate event (client-to-server)."""
    try:
        payload = GenerateScenarioPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _scenario_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="scenario",
                group_id=None,
                resource_type="scenario",
            ),
            sid=sid,
        )


@internal_sio.on("scenario_generate")  # type: ignore
async def scenario_generate_internal(data: dict[str, Any]) -> None:
    """Handle scenario_generate event from internal bus (server-to-server)."""
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
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateScenarioPayload(**data)
        await _scenario_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="scenario",
                group_id=None,
                resource_type="scenario",
            ),
            sid=sid,
        )
