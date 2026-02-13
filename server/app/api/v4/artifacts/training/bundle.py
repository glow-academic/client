"""Training bundle artifact endpoint.

Section-first three-layer implementation (mirrors scenario/get.py):
1) get_training_bundle_internal() - MV view → draft override → hydrate all 14 → config chain
2) get_training_bundle_websocket() - thin wrapper for socket consumers
3) get_training_bundle_client() - HTTP section-first payload formatter
"""

import asyncio
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from typing import Annotated, Any, TypeVar, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.artifacts.training.get import get_training_websocket
from app.api.v4.artifacts.training.permissions import compute_bundle_section_show
from app.api.v4.artifacts.training.types import (
    BaseTrainingBundleSection,
    GetTrainingBundleRequest,
    GetTrainingBundleResponse,
    GetTrainingBundleWebsocketResponse,
    TrainingBundleDepartmentSection,
    TrainingBundleDocumentSection,
    TrainingBundleFieldSection,
    TrainingBundleImageSection,
    TrainingBundleObjectiveSection,
    TrainingBundleOptionSection,
    TrainingBundleParameterFieldSection,
    TrainingBundleParameterSection,
    TrainingBundlePersonaSection,
    TrainingBundleProblemStatementSection,
    TrainingBundleQuestionSection,
    TrainingBundleScenarioFlags,
    TrainingBundleScenarioSection,
    TrainingBundleVideoSection,
    TrainingBundleWebsocketResources,
    TrainingBundleWebsocketViews,
)
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.fields.get import get_fields_internal
from app.api.v4.resources.images.types import get_images_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.objectives.types import get_objectives_internal
from app.api.v4.resources.options.types import get_options_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.problem_statements.types import (
    get_problem_statements_internal,
)
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.questions.types import get_questions_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.resources.videos.types import get_videos_internal
from app.api.v4.views.drafts.get import get_draft_training_internal
from app.api.v4.views.drafts.types import DraftTrainingViewItem
from app.api.v4.views.training.bundle.get import get_training_bundle_view_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


# =============================================================================
# Internal Data
# =============================================================================


@dataclass
class TrainingBundleInternalData:
    training_bundle_entry_id: UUID
    training_id: UUID | None
    simulation_id: UUID | None
    simulation_name: str | None
    scenario_id: UUID | None
    profile_has_access: bool
    group_id: UUID | None
    draft_version: int | None
    scenario_flags: dict[str, bool] = field(default_factory=dict)
    show_flags_map: dict[str, bool] = field(default_factory=dict)
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    # Per-resource: all (suggestions) and current (selected)
    all_resources: dict[str, list[Any]] = field(default_factory=dict)
    current_resources: dict[str, list[Any]] = field(default_factory=dict)
    # Config chain
    config_agents: list[Any] = field(default_factory=list)
    config_models: list[Any] = field(default_factory=list)
    config_providers: list[Any] = field(default_factory=list)
    config_tools: list[Any] = field(default_factory=list)
    # Draft view
    draft_item: DraftTrainingViewItem | None = None


# =============================================================================
# Helpers
# =============================================================================

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


# Resource key → (view_data attr for IDs, draft_item attr, get_*_internal func, id_attr for filtering)
RESOURCE_CONFIG: list[tuple[str, str, str, Any, str]] = [
    (
        "departments",
        "department_ids",
        "department_ids",
        get_departments_internal,
        "department_id",
    ),
    ("personas", "persona_ids", "persona_ids", get_personas_internal, "persona_id"),
    (
        "documents",
        "document_ids",
        "document_ids",
        get_documents_internal,
        "document_id",
    ),
    (
        "parameter_fields",
        "parameter_field_ids",
        "parameter_field_ids",
        get_parameter_fields_internal,
        "field_id",
    ),
    ("scenarios", "scenario_ids", None, get_scenarios_internal, "scenario_id"),
    (
        "parameters",
        "parameter_ids",
        "parameter_ids",
        get_parameters_internal,
        "parameter_id",
    ),
    ("fields", "field_ids", "field_ids", get_fields_internal, "field_id"),
    (
        "questions",
        "question_ids",
        "question_ids",
        get_questions_internal,
        "question_id",
    ),
    ("options", "option_ids", "option_ids", get_options_internal, "option_id"),
    ("videos", "video_ids", "video_ids", get_videos_internal, "video_id"),
    ("images", "image_ids", "image_ids", get_images_internal, "image_id"),
    (
        "problem_statements",
        "problem_statement_ids",
        "problem_statement_ids",
        get_problem_statements_internal,
        "problem_statement_id",
    ),
    (
        "objectives",
        "objective_ids",
        "objective_ids",
        get_objectives_internal,
        "objective_id",
    ),
]


# =============================================================================
# Internal fetch
# =============================================================================


async def get_training_bundle_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_bundle_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> TrainingBundleInternalData:
    """Shared IDs-first + hydration internal fetch for training bundle artifact."""
    # 1. Fetch MV view data (all 14 ID arrays + 6 flags)
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

    # 2. Fetch draft if provided
    draft_item: DraftTrainingViewItem | None = None
    if draft_id is not None:
        draft_items = await get_draft_training_internal(
            conn=conn,
            draft_ids=[draft_id],
            bypass_cache=bypass_cache,
        )
        if draft_items:
            draft_item = draft_items[0]

    # 3. Scenario flags from MV
    scenario_flags: dict[str, bool] = {
        "video_enabled": view_data.video_enabled,
        "problem_statement_enabled": view_data.problem_statement_enabled,
        "objectives_enabled": view_data.objectives_enabled,
        "images_enabled": view_data.images_enabled,
        "questions_enabled": view_data.questions_enabled,
    }

    # 4. Draft override for all 13 customizable resource ID arrays
    selected_ids: dict[str, list[UUID]] = {}
    for resource_key, view_attr, draft_attr, _fetch_fn, _id_attr in RESOURCE_CONFIG:
        mv_ids = list(getattr(view_data, view_attr, []) or [])
        if draft_attr and draft_item:
            draft_val = getattr(draft_item, draft_attr, None)
            selected_ids[resource_key] = list(draft_val) if draft_val else mv_ids
        else:
            selected_ids[resource_key] = mv_ids

    # 5. Hydrate ALL 14 resources in parallel
    FetchFn = Callable[..., Coroutine[Any, Any, list[Any]]]

    async def _fetch_resource(
        resource_key: str,
        view_attr: str,
        fetch_fn: FetchFn,
    ) -> tuple[str, list[Any]]:
        all_ids = list(getattr(view_data, view_attr, []) or [])
        if not all_ids:
            return (resource_key, [])
        return (resource_key, await fetch_fn(conn, all_ids, bypass_cache))

    fetch_tasks = [
        _fetch_resource(rk, va, fn) for rk, va, _da, fn, _ia in RESOURCE_CONFIG
    ]
    fetch_results = await asyncio.gather(*fetch_tasks)

    all_resources: dict[str, list[Any]] = {}
    for resource_key, items in fetch_results:
        all_resources[resource_key] = items

    # 6. Filter current selections from full lists
    current_resources: dict[str, list[Any]] = {}
    for resource_key, _view_attr, _draft_attr, _fetch_fn, id_attr in RESOURCE_CONFIG:
        current_resources[resource_key] = _filter_by_ids(
            all_resources.get(resource_key, []),
            selected_ids.get(resource_key, []),
            id_attr,
        )

    # 7. Compute show flags using scenario flags
    show_flags_map: dict[str, bool] = {}
    for resource_key, _va, _da, _fn, _ia in RESOURCE_CONFIG:
        show_flags_map[resource_key] = compute_bundle_section_show(
            resource_key, scenario_flags
        )

    # 8. Config chain (department → start context → agent/model/provider/tools)
    selected_department_ids = selected_ids.get("departments", [])
    selected_department_id = (
        selected_department_ids[0] if selected_department_ids else None
    )
    if not selected_department_id and view_data.department_ids:
        selected_department_id = view_data.department_ids[0]

    config_agents: list[Any] = []
    config_models: list[Any] = []
    config_providers: list[Any] = []
    config_tools: list[Any] = []
    selected_agent_id: UUID | None = None
    simulation_id: UUID | None = None
    scenario_id: UUID | None = None

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
                conn, [selected_agent_id], bypass_cache
            )
        if model_id:
            config_models = await get_models_internal(conn, [model_id], bypass_cache)
        if provider_id:
            config_providers = await get_providers_internal(
                conn, [provider_id], bypass_cache
            )

        tool_ids: list[UUID] = []
        for agent in config_agents:
            if agent.tool_ids:
                tool_ids.extend(agent.tool_ids)
        if tool_ids:
            unique_tool_ids = list(dict.fromkeys(tool_ids))
            config_tools = await get_tools_internal(conn, unique_tool_ids, bypass_cache)

    # 9. Resolve simulation name
    simulation_name: str | None = None
    if simulation_id:
        from app.api.v4.resources.simulations.types import (
            get_simulations_batch_internal,
        )

        sim_list = await get_simulations_batch_internal(
            conn, [simulation_id], bypass_cache=bypass_cache
        )
        if sim_list:
            simulation_name = sim_list[0].title

    # 10. Resource agent IDs
    resource_agent_ids: dict[str, UUID | None] = {
        rk: selected_agent_id for rk, _va, _da, _fn, _ia in RESOURCE_CONFIG
    }

    return TrainingBundleInternalData(
        training_bundle_entry_id=view_data.training_bundle_entry_id,
        training_id=view_data.training_id,
        simulation_id=simulation_id,
        simulation_name=simulation_name,
        scenario_id=scenario_id,
        profile_has_access=view_data.profile_has_access,
        group_id=draft_item.group_id if draft_item else None,
        draft_version=draft_item.version if draft_item else None,
        scenario_flags=scenario_flags,
        show_flags_map=show_flags_map,
        resource_agent_ids=resource_agent_ids,
        all_resources=all_resources,
        current_resources=current_resources,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        draft_item=draft_item,
    )


# =============================================================================
# WebSocket Layer
# =============================================================================


async def get_training_bundle_websocket(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_bundle_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetTrainingBundleWebsocketResponse:
    """Thin wrapper for websocket consumers — selected resources only."""
    data = await get_training_bundle_internal(
        conn=conn,
        profile_id=profile_id,
        training_bundle_entry_id=training_bundle_entry_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )
    return GetTrainingBundleWebsocketResponse(
        views=TrainingBundleWebsocketViews(draft_training_bundle=data.draft_item),
        resources=TrainingBundleWebsocketResources(
            departments=data.current_resources.get("departments") or None,
            personas=data.current_resources.get("personas") or None,
            documents=data.current_resources.get("documents") or None,
            parameter_fields=data.current_resources.get("parameter_fields") or None,
            scenarios=data.current_resources.get("scenarios") or None,
            parameters=data.current_resources.get("parameters") or None,
            fields=data.current_resources.get("fields") or None,
            questions=data.current_resources.get("questions") or None,
            options=data.current_resources.get("options") or None,
            videos=data.current_resources.get("videos") or None,
            images=data.current_resources.get("images") or None,
            problem_statements=data.current_resources.get("problem_statements") or None,
            objectives=data.current_resources.get("objectives") or None,
            agents=data.config_agents or None,
            models=data.config_models or None,
            providers=data.config_providers or None,
            tools=data.config_tools or None,
        ),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


# =============================================================================
# Client/BFF Layer
# =============================================================================


# Section class mapping for building typed sections
_SECTION_CLASSES: dict[str, type] = {
    "departments": TrainingBundleDepartmentSection,
    "personas": TrainingBundlePersonaSection,
    "documents": TrainingBundleDocumentSection,
    "parameter_fields": TrainingBundleParameterFieldSection,
    "scenarios": TrainingBundleScenarioSection,
    "parameters": TrainingBundleParameterSection,
    "fields": TrainingBundleFieldSection,
    "questions": TrainingBundleQuestionSection,
    "options": TrainingBundleOptionSection,
    "videos": TrainingBundleVideoSection,
    "images": TrainingBundleImageSection,
    "problem_statements": TrainingBundleProblemStatementSection,
    "objectives": TrainingBundleObjectiveSection,
}


async def get_training_bundle_client(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_bundle_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetTrainingBundleResponse:
    """HTTP-facing bundle response formatter — section-first pattern."""
    data = await get_training_bundle_internal(
        conn=conn,
        profile_id=profile_id,
        training_bundle_entry_id=training_bundle_entry_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    def _section(resource_key: str) -> BaseTrainingBundleSection:
        cls = _SECTION_CLASSES[resource_key]
        return cls(
            show=data.show_flags_map.get(resource_key, True),
            required=False,
            show_ai_generate=data.resource_agent_ids.get(resource_key) is not None,
            current=data.current_resources.get(resource_key) or None,
            resources=data.all_resources.get(resource_key) or None,
        )

    return GetTrainingBundleResponse(
        training_bundle_entry_id=data.training_bundle_entry_id,
        training_id=data.training_id,
        simulation_id=data.simulation_id,
        simulation_name=data.simulation_name,
        scenario_id=data.scenario_id,
        profile_has_access=data.profile_has_access,
        group_id=data.group_id,
        draft_version=data.draft_version,
        scenario_flags=TrainingBundleScenarioFlags(**data.scenario_flags),
        departments=_section("departments"),
        personas=_section("personas"),
        documents=_section("documents"),
        parameter_fields=_section("parameter_fields"),
        scenarios=_section("scenarios"),
        parameters=_section("parameters"),
        fields=_section("fields"),
        questions=_section("questions"),
        options=_section("options"),
        videos=_section("videos"),
        images=_section("images"),
        problem_statements=_section("problem_statements"),
        objectives=_section("objectives"),
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=data.config_tools or None,
    )


# =============================================================================
# Route Handler
# =============================================================================


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
