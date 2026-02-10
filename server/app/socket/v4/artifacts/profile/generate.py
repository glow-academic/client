"""Profile generation router - unified handler for profile resource types."""

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.profile.get import get_profile_websocket
from app.api.v4.artifacts.profile.types import GetProfileWebsocketResponse
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.profile.types import GenerateProfilePayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

PROFILE_RESOURCE_TYPES = [
    "names",
    "flags",
    "request_limits",
    "departments",
    "emails",
    "cohorts",
]


def _build_profile_jinja_context(
    response: GetProfileWebsocketResponse,
) -> dict[str, Any]:
    context: dict[str, Any] = (
        response.resources.model_dump() if response.resources else {}
    )
    context["views"] = {
        "draft_profile": (
            response.views.draft_profile.model_dump(mode="json")
            if response.views and response.views.draft_profile
            else {}
        )
    }
    return context


async def _profile_generate_impl(
    sid: str, data: GenerateProfilePayload, profile_id: uuid.UUID
) -> None:
    try:
        if not data.resource_types:
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

        if not data.draft_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Draft ID is required for profile generation",
                    artifact_type="profile",
                    group_id=None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in data.resource_types if rt not in PROFILE_RESOURCE_TYPES
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

        target_profile_id = data.target_profile_id
        if not target_profile_id and data.staff_id:
            target_profile_id = uuid.UUID(data.staff_id)

        result = await get_profile_websocket(
            profile_id=profile_id,
            target_profile_id=target_profile_id,
            draft_id=data.draft_id,
        )

        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = None
        for rt in data.resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is not None:
                agent_id = aid
                break

        if agent_id is None:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested resource types",
                    artifact_type="profile",
                    group_id=str(result.group_id) if result.group_id else None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        config_agents = result.resources.agents or []
        config_models = result.resources.models or []
        config_providers = result.resources.providers or []
        config_tools = result.resources.tools or []

        agent_resource = next((a for a in config_agents if a.id == agent_id), None)
        if not agent_resource and config_agents:
            agent_resource = config_agents[0]
        if not agent_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent configuration found for generation",
                    artifact_type="profile",
                    group_id=str(result.group_id) if result.group_id else None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        model_resource = next(
            (
                m
                for m in config_models
                if m.id is not None
                and m.id == getattr(agent_resource, "model_id", None)
            ),
            None,
        )
        if not model_resource and config_models:
            model_resource = config_models[0]
        if not model_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No model configuration found for generation",
                    artifact_type="profile",
                    group_id=str(result.group_id) if result.group_id else None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        provider_resource = next(
            (
                p
                for p in config_providers
                if p.id is not None
                and p.id == getattr(model_resource, "provider_id", None)
            ),
            None,
        )
        if not provider_resource and config_providers:
            provider_resource = config_providers[0]
        if not provider_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No provider configuration found for generation",
                    artifact_type="profile",
                    group_id=str(result.group_id) if result.group_id else None,
                    resource_type="profile",
                ),
                sid=sid,
            )
            return

        model_name = model_resource.value or model_resource.name
        provider_name = provider_resource.value or provider_resource.name
        base_url = provider_resource.endpoint
        api_key = provider_resource.key

        profile_jinja_context = _build_profile_jinja_context(result)

        resources_bucket = result.resources
        resources: list[dict[str, Any]] = []

        def add_resource_ids(
            resource_type: str, items: list[Any] | None, id_attr: str
        ) -> None:
            if items and resource_type in data.resource_types:
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

        add_resource_ids("names", resources_bucket.names, "id")
        add_resource_ids("emails", resources_bucket.emails, "id")
        add_resource_ids("request_limits", resources_bucket.request_limits, "id")
        add_resource_ids("departments", resources_bucket.departments, "department_id")
        add_resource_ids("cohorts", resources_bucket.cohorts, "cohort_id")
        add_resource_ids("flags", resources_bucket.flags, "flag_option_id")

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

            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")

            async def fetch_system_prompt() -> str:
                prompt_id = getattr(agent_resource, "prompt_id", None)
                if not prompt_id:
                    return ""
                async with pool.acquire() as c:
                    prompts = await get_prompts_internal(c, [prompt_id])
                    return prompts[0].system_prompt or "" if prompts else ""

            async def fetch_developer_templates() -> list[str]:
                instruction_ids = getattr(agent_resource, "instruction_ids", None) or []
                if not instruction_ids:
                    return []
                async with pool.acquire() as c:
                    instructions = await get_instructions_internal(c, instruction_ids)
                    return [i.template for i in instructions if i.template]

            system_prompt, developer_templates = await asyncio.gather(
                fetch_system_prompt(),
                fetch_developer_templates(),
            )

            rendered_developer_messages = render_developer_instructions(
                templates=developer_templates,
                jinja_context=run_context_row.get("context") or profile_jinja_context,
            )

            messages: list[dict[str, Any]] = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            for dev_msg in rendered_developer_messages:
                messages.append({"role": "developer", "content": dev_msg})
            for user_msg in data.user_instructions or []:
                messages.append({"role": "user", "content": user_msg})

            resource_type = data.resource_types[0] if data.resource_types else "profile"

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
                        "model": model_name,
                        "api_key": api_key,
                        "base_url": base_url,
                        "temperature": agent_resource.temperature,
                        "reasoning": agent_resource.reasoning,
                        "provider": provider_name,
                        "voice": agent_resource.voice,
                        "quality": agent_resource.quality,
                        "length_seconds": None,
                    },
                    "tools": convert_tools_to_dict(config_tools),
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
