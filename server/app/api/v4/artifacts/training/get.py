"""Training bundle artifact endpoint.

Section-first three-layer implementation (mirrors scenario/get.py):
1) get_training_internal() - MV view → draft override → hydrate all 14 → config chain
2) get_training_websocket() - thin wrapper for socket consumers
3) get_training_client() - HTTP section-first payload formatter
"""

import asyncio
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any, TypeVar, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Request

from app.api.v4.artifacts.training.permissions import (
    TRAINING_BUNDLE_RESOURCES,
    compute_bundle_section_show,
)
from app.api.v4.artifacts.training.types import (
    BaseTrainingSection,
    GetTrainingRequest,
    GetTrainingResponse,
    GetTrainingStartWebsocketResponse,
    GetTrainingWebsocketResponse,
    TrainingDepartmentSection,
    TrainingDocumentSection,
    TrainingImageSection,
    TrainingObjectiveSection,
    TrainingOptionSection,
    TrainingParameterFieldSection,
    TrainingParameterSection,
    TrainingPersonaSection,
    TrainingProblemStatementSection,
    TrainingQuestionSection,
    TrainingScenarioFlags,
    TrainingScenarioSection,
    TrainingStartWebsocketResources,
    TrainingStartWebsocketViews,
    TrainingVideoSection,
    TrainingWebsocketResources,
    TrainingWebsocketViews,
)
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.entries.runs.search import get_run_list_entries_internal
from app.api.v4.entries.training.get import get_training_view_internal
from app.api.v4.entries.training_drafts.get import get_training_drafts_entries_internal
from app.api.v4.permissions import resolve_agents_for_artifact
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.images.get import get_images_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.objectives.get import get_objectives_internal
from app.api.v4.resources.options.get import get_options_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.problem_statements.get import (
    get_problem_statements_internal,
)
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.questions.get import get_questions_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.videos.get import get_videos_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_pool
from app.sql.types import (
    GetTrainingStartContextSqlParams,
    GetTrainingStartContextSqlRow,
    QGetTrainingDraftsEntriesV4Item,
)
from app.utils.sql_helper import execute_sql_typed

router = APIRouter()

SQL_PATH_START_CONTEXT = (
    "app/sql/v4/queries/generate/training/get_training_start_context_complete.sql"
)


# =============================================================================
# Training Start Context (moved from list.py)
# =============================================================================


async def get_training_start_context(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_entry_id: UUID,
    department_id: UUID,
    draft_id: UUID | None = None,
) -> GetTrainingStartWebsocketResponse:
    """Thin websocket fetch for training start flow."""
    params = GetTrainingStartContextSqlParams(
        p_profile_id=profile_id,
        p_training_entry_id=training_entry_id,
        p_department_id=department_id,
        p_draft_id=draft_id,
    )

    row = cast(
        GetTrainingStartContextSqlRow,
        await execute_sql_typed(conn, SQL_PATH_START_CONTEXT, params=params),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Training start context not found")

    return GetTrainingStartWebsocketResponse(
        views=TrainingStartWebsocketViews(
            training_entry_id=training_entry_id,
            department_id=department_id,
        ),
        resources=TrainingStartWebsocketResources(
            simulation_id=row.simulation_id,
            scenario_id=row.scenario_id,
            problem_statement=row.problem_statement,
            objectives=row.objectives,
            persona=row.persona,
            video_ids=list(row.video_ids) if row.video_ids else None,
            image_ids=list(row.image_ids) if row.image_ids else None,
            has_problem_statement=row.has_problem_statement or False,
            has_persona=row.has_persona or False,
            agent_id=row.agent_id,
            agent_exists=row.agent_exists or False,
            agent_name=row.agent_name,
            agent_is_active=row.agent_is_active or False,
            model_id=row.model_id,
            model_name=row.model_name,
            provider_id=row.provider_id,
            provider_name=row.provider_name,
            has_api_key=row.has_api_key or False,
            requests_per_day=row.requests_per_day,
            runs_today=int(row.runs_today or 0),
            simulation_exists=row.simulation_exists or False,
            simulation_is_active=row.simulation_is_active or False,
            profile_has_access=row.profile_has_access or False,
            valid_entry_types=list(row.valid_entry_types or []),
        ),
    )


# =============================================================================
# Internal Data
# =============================================================================


@dataclass
class TrainingInternalData:
    training_entry_id: UUID
    parent_id: UUID | None
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
    draft_item: QGetTrainingDraftsEntriesV4Item | None = None


# =============================================================================
# Helpers
# =============================================================================

T = TypeVar("T")


def _ids_from_attr(obj: Any, attr: str) -> list[UUID]:
    """Extract IDs from a view_data attribute — handles both list and single UUID."""
    val = getattr(obj, attr, None)
    if val is None:
        return []
    if isinstance(val, list):
        return list(val)
    return [val]


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
    ("scenarios", "scenario_id", None, get_scenarios_internal, "scenario_id"),
    (
        "parameters",
        "parameter_ids",
        "parameter_ids",
        get_parameters_internal,
        "parameter_id",
    ),
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


async def get_training_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    training_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> TrainingInternalData:
    """Shared IDs-first + hydration internal fetch for training bundle artifact."""
    # 1. Fetch MV view data (all 14 ID arrays + 6 flags)
    async with pool.acquire() as conn:
        view_data = await get_training_view_internal(
            conn=conn,
            profile_id=profile_id,
            training_entry_id=training_entry_id,
        )

    if not view_data.training_entry_id:
        raise HTTPException(status_code=404, detail="Training bundle not found")

    if not view_data.profile_has_access:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this training bundle.",
        )

    # 2. Fetch draft if provided
    draft_item: QGetTrainingDraftsEntriesV4Item | None = None
    if draft_id is not None:
        async with pool.acquire() as conn:
            draft_items = await get_training_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
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
        mv_ids = _ids_from_attr(view_data, view_attr)
        if draft_attr and draft_item:
            draft_val = getattr(draft_item, draft_attr, None)
            selected_ids[resource_key] = list(draft_val) if draft_val else mv_ids
        else:
            selected_ids[resource_key] = mv_ids

    # 5. Hydrate ALL 14 resources in parallel (each acquires its own connection)
    FetchFn = Callable[..., Coroutine[Any, Any, list[Any]]]

    async def _fetch_resource(
        resource_key: str,
        view_attr: str,
        fetch_fn: FetchFn,
    ) -> tuple[str, list[Any]]:
        all_ids = _ids_from_attr(view_data, view_attr)
        if not all_ids:
            return (resource_key, [])
        async with pool.acquire() as c:
            return (resource_key, await fetch_fn(c, all_ids, bypass_cache))

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

    # 8. Settings-based agent resolution + config chain
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, TRAINING_BUNDLE_RESOURCES
    )

    # Config chain from settings (agents + tools already hydrated, models need fetch)
    config_agents = list(settings_data.settings_agents)
    config_tools = list(settings_data.settings_tools)

    config_model_resource_ids = list(
        dict.fromkeys(a.model_id for a in settings_data.settings_agents if a.model_id)
    )
    config_models: list[Any] = []
    if config_model_resource_ids:
        async with pool.acquire() as conn:
            config_models = await get_models_internal(
                conn, config_model_resource_ids, bypass_cache
            )

    config_provider_resource_ids = list(
        dict.fromkeys(m.provider_id for m in config_models if m.provider_id)
    )
    config_providers: list[Any] = []
    if config_provider_resource_ids:
        async with pool.acquire() as conn:
            config_providers = await get_providers_internal(
                conn, config_provider_resource_ids, bypass_cache
            )

    # 9. Simulation/scenario context (from training websocket)
    selected_department_ids = selected_ids.get("departments", [])
    selected_department_id = (
        selected_department_ids[0] if selected_department_ids else None
    )
    if not selected_department_id and view_data.department_ids:
        selected_department_id = view_data.department_ids[0]

    simulation_id: UUID | None = None
    scenario_id: UUID | None = None

    if selected_department_id is not None:
        async with pool.acquire() as conn:
            start_ctx = await get_training_start_context(
                conn=conn,
                profile_id=profile_id,
                training_entry_id=training_entry_id,
                department_id=selected_department_id,
                draft_id=draft_id,
            )
        simulation_id = start_ctx.resources.simulation_id
        scenario_id = start_ctx.resources.scenario_id

    # 10. Resolve simulation name
    simulation_name: str | None = None
    if simulation_id:
        from app.api.v4.resources.simulations.get import (
            get_simulations_internal,
        )

        async with pool.acquire() as conn:
            sim_list = await get_simulations_internal(
                conn, [simulation_id], bypass_cache=bypass_cache
            )
        if sim_list:
            simulation_name = sim_list[0].name

    # 11. Resource agent IDs (from settings-based resolution)
    resource_agent_ids = agent_ids

    return TrainingInternalData(
        training_entry_id=view_data.training_entry_id,
        parent_id=view_data.parent_id,
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


async def get_training_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    training_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetTrainingWebsocketResponse:
    """Thin wrapper for websocket consumers — selected resources only."""

    async def fetch_bundle():
        return await get_training_internal(
            pool=pool,
            profile_id=profile_id,
            training_entry_id=training_entry_id,
            draft_id=draft_id,
            bypass_cache=bypass_cache,
        )

    async def fetch_config_profile():
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn, [profile_id], bypass_cache)

    async def fetch_runs_today():
        from datetime import UTC, datetime

        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as conn:
            return await get_run_list_entries_internal(
                conn=conn,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    (data, config_profile_result, runs_result) = await asyncio.gather(
        fetch_bundle(),
        fetch_config_profile(),
        fetch_runs_today(),
    )

    return GetTrainingWebsocketResponse(
        views=TrainingWebsocketViews(
            draft_training=data.draft_item,
            runs=runs_result,
        ),
        resources=TrainingWebsocketResources(
            departments=data.current_resources.get("departments") or None,
            personas=data.current_resources.get("personas") or None,
            documents=data.current_resources.get("documents") or None,
            parameter_fields=data.current_resources.get("parameter_fields") or None,
            scenarios=data.current_resources.get("scenarios") or None,
            parameters=data.current_resources.get("parameters") or None,
            questions=data.current_resources.get("questions") or None,
            options=data.current_resources.get("options") or None,
            videos=data.current_resources.get("videos") or None,
            images=data.current_resources.get("images") or None,
            problem_statements=data.current_resources.get("problem_statements") or None,
            objectives=data.current_resources.get("objectives") or None,
            config_agents=data.config_agents or None,
            config_models=data.config_models or None,
            config_providers=data.config_providers or None,
            config_tools=data.config_tools or None,
            config_profile=config_profile_result or None,
        ),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


# =============================================================================
# Client/BFF Layer
# =============================================================================


# Section class mapping for building typed sections
_SECTION_CLASSES: dict[str, type] = {
    "departments": TrainingDepartmentSection,
    "personas": TrainingPersonaSection,
    "documents": TrainingDocumentSection,
    "parameter_fields": TrainingParameterFieldSection,
    "scenarios": TrainingScenarioSection,
    "parameters": TrainingParameterSection,
    "questions": TrainingQuestionSection,
    "options": TrainingOptionSection,
    "videos": TrainingVideoSection,
    "images": TrainingImageSection,
    "problem_statements": TrainingProblemStatementSection,
    "objectives": TrainingObjectiveSection,
}


async def get_training_client(
    pool: asyncpg.Pool,
    profile_id: UUID,
    training_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetTrainingResponse:
    """HTTP-facing bundle response formatter — section-first pattern."""
    data = await get_training_internal(
        pool=pool,
        profile_id=profile_id,
        training_entry_id=training_entry_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    def _section(resource_key: str) -> BaseTrainingSection:
        cls = _SECTION_CLASSES[resource_key]
        return cls(
            show=data.show_flags_map.get(resource_key, True),
            required=False,
            show_ai_generate=data.resource_agent_ids.get(resource_key) is not None,
            current=data.current_resources.get(resource_key) or None,
            resources=data.all_resources.get(resource_key) or None,
        )

    return GetTrainingResponse(
        training_entry_id=data.training_entry_id,
        parent_id=data.parent_id,
        simulation_id=data.simulation_id,
        simulation_name=data.simulation_name,
        scenario_id=data.scenario_id,
        profile_has_access=data.profile_has_access,
        group_id=data.group_id,
        draft_version=data.draft_version,
        scenario_flags=TrainingScenarioFlags(**data.scenario_flags),
        departments=_section("departments"),
        personas=_section("personas"),
        documents=_section("documents"),
        parameter_fields=_section("parameter_fields"),
        scenarios=_section("scenarios"),
        parameters=_section("parameters"),
        questions=_section("questions"),
        options=_section("options"),
        videos=_section("videos"),
        images=_section("images"),
        problem_statements=_section("problem_statements"),
        objectives=_section("objectives"),
        config_agents=data.config_agents or None,
        config_models=data.config_models or None,
        config_providers=data.config_providers or None,
        config_tools=data.config_tools or None,
    )


# =============================================================================
# Route Handler
# =============================================================================


@router.post("/get", response_model=GetTrainingResponse)
async def training_get(
    request: GetTrainingRequest,
    http_request: Request,
) -> GetTrainingResponse:
    """Get hydrated resources for training bundle customization."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        return await get_training_client(
            pool=pool,
            profile_id=cast(UUID, profile_id),
            training_entry_id=request.training_entry_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="training_get",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
