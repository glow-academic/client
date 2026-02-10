"""Simulation generation router - unified handler for all simulation resource types."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.simulation.get import get_simulation_websocket
from app.api.v4.artifacts.simulation.types import GetSimulationWebsocketResponse
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.simulation.types import GenerateSimulationPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.utils.sql_helper import load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

SIMULATION_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "departments",
    "flags",
    "scenarios",
    "scenario_flags",
    "scenario_personas",
    "scenario_positions",
    "scenario_rubrics",
    "scenario_time_limits",
]


def _build_simulation_jinja_context(
    response: GetSimulationWebsocketResponse,
) -> dict[str, Any]:
    """Build Jinja context from websocket resources payload."""
    context: dict[str, Any] = (
        response.resources.model_dump() if response.resources else {}
    )
    context["views"] = {
        "draft_simulation": (
            response.views.draft_simulation.model_dump(mode="json")
            if response.views and response.views.draft_simulation
            else {}
        )
    }
    return context


async def _emit_generation_error(
    sid: str,
    *,
    message: str,
    group_id: uuid.UUID | None = None,
) -> None:
    await emit_to_internal(
        "generate_call_error",
        GenerateErrorApiRequest(
            sid=sid,
            error_message=message,
            artifact_type="simulation",
            group_id=str(group_id) if group_id else None,
            resource_type="simulation",
        ),
        sid=sid,
    )


def _resolve_agent_id(
    resource_types: list[str],
    resource_agent_ids: dict[str, uuid.UUID | None],
) -> uuid.UUID | None:
    for resource_type in resource_types:
        candidate = resource_agent_ids.get(resource_type)
        if candidate is not None:
            return candidate
    return None


def _select_generation_config_resources(
    response: GetSimulationWebsocketResponse,
    agent_id: uuid.UUID,
) -> tuple[Any | None, Any | None, Any | None]:
    resources = response.resources
    config_agents = resources.agents or []
    config_models = resources.models or []
    config_providers = resources.providers or []

    agent_resource = next(
        (a for a in config_agents if getattr(a, "id", None) == agent_id),
        config_agents[0] if config_agents else None,
    )
    model_id = getattr(agent_resource, "model_id", None)
    model_resource = next(
        (m for m in config_models if getattr(m, "id", None) == model_id),
        config_models[0] if config_models else None,
    )
    provider_id = getattr(model_resource, "provider_id", None)
    provider_resource = next(
        (p for p in config_providers if getattr(p, "id", None) == provider_id),
        config_providers[0] if config_providers else None,
    )

    return agent_resource, model_resource, provider_resource


def _build_generation_resources(
    response: GetSimulationWebsocketResponse,
    resource_types: list[str],
) -> list[dict[str, Any]]:
    resources: list[dict[str, Any]] = []
    resources_bucket = response.resources

    def add_resource_ids(
        resource_type: str, items: list[Any] | None, id_attr: str
    ) -> None:
        if not items or resource_type not in resource_types:
            return
        ids: list[str] = []
        for item in items:
            item_id = (
                item.get(id_attr)
                if isinstance(item, dict)
                else getattr(item, id_attr, None)
            )
            if item_id:
                ids.append(str(item_id))
        if ids:
            resources.append({"resource_type": resource_type, "resource_ids": ids})

    add_resource_ids("names", resources_bucket.names, "id")
    add_resource_ids("descriptions", resources_bucket.descriptions, "id")
    add_resource_ids("departments", resources_bucket.departments, "department_id")
    add_resource_ids("flags", resources_bucket.flags, "flag_option_id")
    add_resource_ids("scenarios", resources_bucket.scenarios, "scenario_id")
    add_resource_ids("scenario_flags", resources_bucket.scenario_flags, "id")
    add_resource_ids("scenario_personas", resources_bucket.scenario_personas, "id")
    add_resource_ids("scenario_positions", resources_bucket.scenario_positions, "id")
    add_resource_ids("scenario_rubrics", resources_bucket.scenario_rubrics, "id")
    add_resource_ids(
        "scenario_time_limits", resources_bucket.scenario_time_limits, "id"
    )

    return resources


async def _simulation_generate_impl(
    sid: str, data: GenerateSimulationPayload, profile_id: uuid.UUID
) -> None:
    """Handle simulation generation with resource-type based routing."""
    try:
        if not data.resource_types:
            await _emit_generation_error(sid, message="resource_types must be provided")
            return

        if not data.draft_id:
            await _emit_generation_error(
                sid, message="Draft ID is required for simulation generation"
            )
            return

        resource_types = data.resource_types
        invalid_types = [
            resource_type
            for resource_type in resource_types
            if resource_type not in SIMULATION_RESOURCE_TYPES
        ]
        if invalid_types:
            await _emit_generation_error(
                sid,
                message=f"Invalid resource types: {', '.join(invalid_types)}",
            )
            return

        result = await get_simulation_websocket(
            profile_id=profile_id,
            simulation_id=data.simulation_id,
            draft_id=data.draft_id,
        )

        agent_id = _resolve_agent_id(resource_types, result.resource_agent_ids or {})
        if not agent_id:
            await _emit_generation_error(
                sid,
                message="No agent found for the requested resource types",
                group_id=result.group_id,
            )
            return

        agent_resource, model_resource, provider_resource = (
            _select_generation_config_resources(result, agent_id)
        )
        if not agent_resource:
            await _emit_generation_error(
                sid,
                message="No agent configuration found. Check department settings.",
                group_id=result.group_id,
            )
            return
        if not model_resource:
            await _emit_generation_error(
                sid,
                message=f"Agent '{getattr(agent_resource, 'name', 'unknown')}' has no model configured",
                group_id=result.group_id,
            )
            return
        if not provider_resource:
            await _emit_generation_error(
                sid,
                message=f"Model '{getattr(model_resource, 'name', 'unknown')}' has no provider configured",
                group_id=result.group_id,
            )
            return

        # Shared text context SQL should provide model+provider+keys,
        # but we fail fast here using pre-fetched websocket resources.
        preloaded_api_key = getattr(model_resource, "key", None)
        if not preloaded_api_key:
            provider_name = getattr(provider_resource, "value", None) or getattr(
                provider_resource, "name", "unknown"
            )
            await _emit_generation_error(
                sid,
                message=f"No API key configured for provider '{provider_name}'",
                group_id=result.group_id,
            )
            return

        simulation_jinja_context = _build_simulation_jinja_context(result)
        resources = _build_generation_resources(result, resource_types)
        group_id = result.group_id
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
                await _emit_generation_error(
                    sid,
                    message="Failed to create generation run",
                    group_id=group_id,
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
                await _emit_generation_error(
                    sid,
                    message="Failed to load generation context",
                    group_id=group_id,
                )
                return

            rendered_developer_messages = render_developer_instructions(
                templates=run_context_row.get("developer_instruction_templates"),
                jinja_context=run_context_row.get("context")
                or simulation_jinja_context,
            )

            messages: list[dict[str, Any]] = []
            if run_context_row.get("system_prompt"):
                messages.append(
                    {"role": "system", "content": run_context_row["system_prompt"]}
                )
            for developer_message in rendered_developer_messages:
                messages.append({"role": "developer", "content": developer_message})
            for user_message in data.user_instructions or []:
                messages.append({"role": "user", "content": user_message})

            model_name = (
                run_context_row.get("model_name")
                or getattr(model_resource, "value", None)
                or getattr(model_resource, "name", None)
            )
            provider_name = (
                run_context_row.get("provider")
                or getattr(provider_resource, "value", None)
                or getattr(provider_resource, "name", None)
            )
            base_url = run_context_row.get("base_url") or getattr(
                model_resource, "endpoint", None
            )
            api_key = run_context_row.get("api_key") or preloaded_api_key
            temperature = run_context_row.get("temperature")
            if temperature is None:
                temperature = getattr(agent_resource, "temperature", 0.0)
            reasoning = run_context_row.get("reasoning")
            if reasoning is None:
                reasoning = getattr(agent_resource, "reasoning", None)

            if not api_key:
                await _emit_generation_error(
                    sid,
                    message="No API key configured for selected model/provider",
                    group_id=group_id,
                )
                return

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "simulation",
                    "resource_type": resource_types[0]
                    if resource_types
                    else "simulation",
                    "run_id": run_id,
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
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                    "tools": convert_tools_to_dict(run_context_row.get("tools")),
                },
            )

    except Exception as error:
        await _emit_generation_error(
            sid,
            message=f"Failed to generate simulation resources: {str(error)}",
        )


@sio.event  # type: ignore
async def simulation_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_generate event (client-to-server)."""
    try:
        payload = GenerateSimulationPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await _emit_generation_error(
                sid, message="Profile not found. Please reconnect."
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _simulation_generate_impl(sid, payload, profile_id)
    except Exception as error:
        await _emit_generation_error(sid, message=f"Invalid request: {str(error)}")


@internal_sio.on("simulation_generate")  # type: ignore
async def simulation_generate_internal(data: dict[str, Any]) -> None:
    """Handle simulation_generate event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await _emit_generation_error(
                sid, message="Profile not found. Please reconnect."
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateSimulationPayload(**data)
        await _simulation_generate_impl(sid, payload, profile_id)
    except Exception as error:
        await _emit_generation_error(sid, message=f"Invalid request: {str(error)}")
