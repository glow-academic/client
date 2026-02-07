"""Scenario generation router - unified handler for all scenario resource types.

Supports two modes:
1. Legacy: agent_type + resource_types (backwards compat)
2. Domain-based: domain_ids (new, matching persona pattern)
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.scenario.get import get_scenario_websocket
from app.api.v4.artifacts.scenario.types import (
    GetScenarioApiRequest,
    GetScenarioWebsocketResponse,
    ScenarioResourceBucket,
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

    # New domain-based approach (preferred)
    domain_ids: list[uuid.UUID] | None = None

    # Legacy agent_type approach (backwards compat)
    agent_type: str | None = (
        None  # Optional: "name", "description", "basic", "content", "general"/"all"
    )
    resource_types: list[str] | None = None  # Which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


def _build_scenario_jinja_context(
    response: GetScenarioWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from scenario websocket response."""
    if response.resources and response.resources.resources:
        resources = response.resources.resources.model_dump()
        current = (
            response.resources.current.model_dump()
            if response.resources.current
            else ScenarioResourceBucket().model_dump()
        )
        resources["current"] = current
        return resources
    return {"current": ScenarioResourceBucket().model_dump()}


async def _scenario_generate_impl(
    sid: str, data: GenerateScenarioPayload, profile_id: uuid.UUID
) -> None:
    """Handle scenario generation - supports both domain-based and legacy agent_type modes."""
    try:
        # Fetch scenario data via websocket function
        result = await get_scenario_websocket(
            profile_id=profile_id,
            scenario_id=data.scenario_id,
            draft_id=data.draft_id,
        )

        if not result.group_id and not data.scenario_id:
            # New scenario without group_id is expected
            pass

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping from result
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.name_domain_id: "names",
            result.description_domain_id: "descriptions",
            result.problem_statement_domain_id: "problem_statements",
            result.flag_domain_id: "scenario_flags",
            result.departments_domain_id: "departments",
            result.personas_domain_id: "personas",
            result.documents_domain_id: "documents",
            result.parameters_domain_id: "parameters",
            result.parameter_fields_domain_id: "fields",
            result.objectives_domain_id: "objectives",
            result.images_domain_id: "images",
            result.videos_domain_id: "videos",
            result.questions_domain_id: "questions",
            result.templates_domain_id: "templates",
        }
        domain_to_resource.pop(None, None)

        # Determine resource_types and agent_id based on mode
        resource_types: list[str] = []
        agent_id: uuid.UUID | None = None

        if data.domain_ids:
            # === NEW DOMAIN-BASED MODE ===
            for did in data.domain_ids:
                if did in domain_to_resource:
                    resource_types.append(domain_to_resource[did])

            if not resource_types:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="No valid domain_ids provided",
                        artifact_type="scenario",
                        group_id=None,
                        resource_type="scenario",
                    ),
                    sid=sid,
                )
                return

            # Get agent_id from the first valid domain_id
            for did in data.domain_ids:
                if did in domain_to_agent and domain_to_agent[did] is not None:
                    agent_id = domain_to_agent[did]
                    break

        elif data.resource_types:
            # === LEGACY AGENT_TYPE MODE ===
            resource_types = data.resource_types

            # Map agent_type to agent_id using domain_to_agent
            # Build resource -> agent_id mapping from domains
            resource_to_agent: dict[str, uuid.UUID | None] = {}
            for domain_id, res_type in domain_to_resource.items():
                if domain_id in domain_to_agent:
                    resource_to_agent[res_type] = domain_to_agent[domain_id]

            if data.agent_type == "name":
                agent_id = resource_to_agent.get("names")
            elif data.agent_type == "description":
                agent_id = resource_to_agent.get("descriptions")
            elif data.agent_type in ("general", "all"):
                # Try to find any agent that's available
                for res_type in SCENARIO_RESOURCE_TYPES:
                    if resource_to_agent.get(res_type):
                        agent_id = resource_to_agent[res_type]
                        break
            elif data.agent_type == "basic":
                # Try names agent first, then any basic resource agent
                for res_type in [
                    "names",
                    "descriptions",
                    "scenario_flags",
                    "departments",
                ]:
                    if resource_to_agent.get(res_type):
                        agent_id = resource_to_agent[res_type]
                        break
            elif data.agent_type == "content":
                # Try personas first, then any content resource agent
                for res_type in [
                    "personas",
                    "documents",
                    "parameters",
                    "fields",
                    "templates",
                    "objectives",
                    "images",
                    "videos",
                    "questions",
                    "problem_statements",
                ]:
                    if resource_to_agent.get(res_type):
                        agent_id = resource_to_agent[res_type]
                        break
        else:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Either domain_ids or resource_types must be provided",
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return

        # Validate resource types
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

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"No agent found for the requested domains/agent_type: {data.agent_type}",
                    artifact_type="scenario",
                    group_id=str(result.group_id) if result.group_id else None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return

        # Build Jinja context from resources
        scenario_jinja_context = _build_scenario_jinja_context(result, resource_types)

        # Build resources array from websocket result
        resources_bucket = result.resources.resources if result.resources else None
        resources: list[dict[str, Any]] = []

        # Helper to extract IDs from resource bucket
        def add_resource_ids(
            resource_type: str, items: list[Any] | None, id_attr: str
        ) -> None:
            if items and resource_type in resource_types:
                ids = []
                for item in items:
                    item_id = (
                        item.get(id_attr)
                        if isinstance(item, dict)
                        else getattr(item, id_attr, None)
                    )
                    if item_id:
                        ids.append(str(item_id))
                if ids:
                    resources.append(
                        {"resource_type": resource_type, "resource_ids": ids}
                    )

        if resources_bucket:
            add_resource_ids("names", resources_bucket.names, "id")
            add_resource_ids("descriptions", resources_bucket.descriptions, "id")
            add_resource_ids(
                "problem_statements",
                resources_bucket.problem_statements,
                "problem_statement_id",
            )
            add_resource_ids(
                "departments", resources_bucket.departments, "department_id"
            )
            add_resource_ids("personas", resources_bucket.personas, "persona_id")
            add_resource_ids("documents", resources_bucket.documents, "document_id")
            add_resource_ids("parameters", resources_bucket.parameters, "parameter_id")
            add_resource_ids("objectives", resources_bucket.objectives, "id")
            add_resource_ids("images", resources_bucket.images, "image_id")
            add_resource_ids("videos", resources_bucket.videos, "video_id")
            add_resource_ids("questions", resources_bucket.questions, "question_id")
            add_resource_ids("templates", resources_bucket.templates, "template_id")

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
                        artifact_type="scenario",
                        group_id=str(group_id) if group_id else None,
                        resource_type="scenario",
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
