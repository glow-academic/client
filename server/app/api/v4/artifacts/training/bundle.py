"""Training bundle artifact endpoint.

Persona-style three-layer implementation:
1) get_training_bundle_internal() - IDs + hydration + draft override + config chain
2) get_training_bundle_websocket() - thin wrapper for socket consumers
3) get_training_bundle_client() - HTTP payload formatter
"""

from dataclasses import dataclass
from typing import Annotated, TypeVar, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.artifacts.training.get import get_training_websocket
from app.api.v4.artifacts.training.types import (
    GetTrainingBundleRequest,
    GetTrainingBundleResponse,
    TrainingBundleResourceBucket,
    TrainingBundleResources,
    TrainingBundleViews,
)
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.scenario_time_limits.get import (
    get_scenario_time_limits_internal,
)
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.views.drafts.get import get_draft_training_internal
from app.api.v4.views.training.bundle.get import get_training_bundle_view_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


@dataclass
class TrainingBundleInternalData:
    training_bundle_entry_id: UUID
    training_id: UUID | None
    simulation_id: UUID | None
    simulation_name: str | None
    scenario_id: UUID | None
    profile_has_access: bool
    views: TrainingBundleViews
    resources: TrainingBundleResources
    resource_agent_ids: dict[str, UUID | None]
    group_id: UUID | None


T = TypeVar("T")


def _filter_by_ids(items: list[T], ids: list[UUID], id_attr: str) -> list[T]:
    if not items or not ids:
        return []
    id_set = {str(i) for i in ids}
    output: list[T] = []
    for item in items:
        value = getattr(item, id_attr, None)
        if value and str(value) in id_set:
            output.append(item)
    return output


async def get_training_bundle_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_bundle_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> TrainingBundleInternalData:
    """Shared IDs-first + hydration internal fetch for training bundle artifact."""
    view_data = await get_training_bundle_view_internal(
        conn=conn,
        profile_id=profile_id,
        training_bundle_entry_id=training_bundle_entry_id,
    )

    if not view_data.training_bundle_entry_id:
        raise HTTPException(status_code=404, detail="Training bundle not found")

    if not view_data.profile_has_access:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this training bundle.",
        )

    draft_item = None
    if draft_id is not None:
        draft_items = await get_draft_training_internal(
            conn=conn,
            draft_ids=[draft_id],
            bypass_cache=bypass_cache,
        )
        if draft_items:
            draft_item = draft_items[0]

    # IDs from draft override MV IDs where applicable.
    selected_department_ids = (
        list(draft_item.department_ids)
        if draft_item and draft_item.department_ids
        else list(view_data.department_ids)
    )
    selected_persona_ids = (
        list(draft_item.persona_ids)
        if draft_item and draft_item.persona_ids
        else list(view_data.persona_ids)
    )
    selected_document_ids = (
        list(draft_item.document_ids)
        if draft_item and draft_item.document_ids
        else list(view_data.document_ids)
    )
    selected_parameter_field_ids = (
        list(draft_item.parameter_field_ids)
        if draft_item and draft_item.parameter_field_ids
        else list(view_data.parameter_field_ids)
    )

    # Suggestions (full allowed bundle scope).
    suggestion_departments = await get_departments_internal(
        conn,
        list(view_data.department_ids),
        bypass_cache=bypass_cache,
    )
    suggestion_personas = await get_personas_internal(
        conn,
        list(view_data.persona_ids),
        bypass_cache=bypass_cache,
    )
    suggestion_documents = await get_documents_internal(
        conn,
        list(view_data.document_ids),
        bypass_cache=bypass_cache,
    )
    suggestion_parameter_fields = await get_parameter_fields_internal(
        conn,
        list(view_data.parameter_field_ids),
        bypass_cache=bypass_cache,
    )

    # Current selection objects.
    current_departments = _filter_by_ids(
        suggestion_departments,
        selected_department_ids,
        "department_id",
    )
    current_personas = _filter_by_ids(
        suggestion_personas,
        selected_persona_ids,
        "persona_id",
    )
    current_documents = _filter_by_ids(
        suggestion_documents,
        selected_document_ids,
        "document_id",
    )
    current_parameter_fields = _filter_by_ids(
        suggestion_parameter_fields,
        selected_parameter_field_ids,
        "field_id",
    )

    # Config chain resources (agent/model/provider/tools) derived from selected department.
    # Also resolves simulation_id, scenario_id, simulation_name.
    selected_department_id = None
    if selected_department_ids:
        selected_department_id = selected_department_ids[0]
    elif view_data.department_ids:
        selected_department_id = view_data.department_ids[0]

    config_agents = []
    config_models = []
    config_providers = []
    config_tools = []
    selected_agent_id: UUID | None = None
    simulation_id: UUID | None = None
    scenario_id: UUID | None = None
    suggestion_scenario_time_limits = []

    if selected_department_id is not None:
        start_ctx = await get_training_websocket(
            conn=conn,
            profile_id=profile_id,
            training_bundle_entry_id=training_bundle_entry_id,
            department_id=selected_department_id,
            draft_id=draft_id,
        )

        selected_agent_id = start_ctx.resources.agent_id
        model_id = start_ctx.resources.model_id
        provider_id = start_ctx.resources.provider_id
        simulation_id = start_ctx.resources.simulation_id
        scenario_id = start_ctx.resources.scenario_id

        if selected_agent_id:
            config_agents = await get_agents_internal(
                conn,
                [selected_agent_id],
                bypass_cache=bypass_cache,
            )
        if model_id:
            config_models = await get_models_internal(
                conn,
                [model_id],
                bypass_cache=bypass_cache,
            )
        if provider_id:
            config_providers = await get_providers_internal(
                conn,
                [provider_id],
                bypass_cache=bypass_cache,
            )

        tool_ids: list[UUID] = []
        if config_agents:
            for agent in config_agents:
                if agent.tool_ids:
                    tool_ids.extend(agent.tool_ids)
        if tool_ids:
            unique_tool_ids = list(dict.fromkeys(tool_ids))
            config_tools = await get_tools_internal(
                conn,
                unique_tool_ids,
                bypass_cache=bypass_cache,
            )

        # Scenario time limits from start context (simulation-level)
        if simulation_id and view_data.scenario_ids:
            suggestion_scenario_time_limits = await get_scenario_time_limits_internal(
                conn=conn,
                simulation_id=simulation_id,
                scenario_ids=view_data.scenario_ids,
                bypass_cache=bypass_cache,
            )

    # Resolve simulation name from simulations resource
    simulation_name: str | None = None
    if simulation_id:
        from app.api.v4.resources.simulations.get import get_simulations_batch_internal

        sim_list = await get_simulations_batch_internal(
            conn, [simulation_id], bypass_cache=bypass_cache
        )
        if sim_list:
            simulation_name = sim_list[0].title

    resource_agent_ids = {
        "departments": selected_agent_id,
        "personas": selected_agent_id,
        "documents": selected_agent_id,
        "parameter_fields": selected_agent_id,
        "scenario_time_limits": selected_agent_id,
    }

    return TrainingBundleInternalData(
        training_bundle_entry_id=view_data.training_bundle_entry_id,
        training_id=view_data.training_id,
        simulation_id=simulation_id,
        simulation_name=simulation_name,
        scenario_id=scenario_id,
        profile_has_access=view_data.profile_has_access,
        views=TrainingBundleViews(draft_training_bundle=draft_item),
        resources=TrainingBundleResources(
            current=TrainingBundleResourceBucket(
                departments=current_departments,
                personas=current_personas,
                documents=current_documents,
                parameter_fields=current_parameter_fields,
                scenario_time_limits=suggestion_scenario_time_limits,
            ),
            suggestions=TrainingBundleResourceBucket(
                departments=suggestion_departments,
                personas=suggestion_personas,
                documents=suggestion_documents,
                parameter_fields=suggestion_parameter_fields,
                scenario_time_limits=suggestion_scenario_time_limits,
            ),
            agents=config_agents,
            models=config_models,
            providers=config_providers,
            tools=config_tools,
        ),
        resource_agent_ids=resource_agent_ids,
        group_id=draft_item.group_id if draft_item else None,
    )


async def get_training_bundle_websocket(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_bundle_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetTrainingBundleResponse:
    """Thin wrapper for websocket consumers reusing internal bundle fetch."""
    data = await get_training_bundle_internal(
        conn=conn,
        profile_id=profile_id,
        training_bundle_entry_id=training_bundle_entry_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )
    return GetTrainingBundleResponse(
        training_bundle_entry_id=data.training_bundle_entry_id,
        training_id=data.training_id,
        simulation_id=data.simulation_id,
        simulation_name=data.simulation_name,
        scenario_id=data.scenario_id,
        profile_has_access=data.profile_has_access,
        views=data.views,
        resources=data.resources,
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def get_training_bundle_client(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_bundle_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetTrainingBundleResponse:
    """HTTP-facing bundle response formatter."""
    return await get_training_bundle_websocket(
        conn=conn,
        profile_id=profile_id,
        training_bundle_entry_id=training_bundle_entry_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )


@router.post("/bundle/get", response_model=GetTrainingBundleResponse)
async def training_bundle_get(
    request: GetTrainingBundleRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTrainingBundleResponse:
    """Get hydrated resources for training bundle customization."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        return await get_training_bundle_client(
            conn=conn,
            profile_id=cast(UUID, profile_id),
            training_bundle_entry_id=request.training_bundle_entry_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="training_bundle_get",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
