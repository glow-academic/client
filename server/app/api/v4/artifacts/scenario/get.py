"""Scenario get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_scenario_internal() - Core data fetching (cacheable, returns dataclass)
2. get_scenario_websocket() - Minimal data for WebSocket handlers
3. get_scenario_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.scenario.permissions import (
    SCENARIO_BASIC_RESOURCES,
    SCENARIO_CONTENT_RESOURCES,
    SCENARIO_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_documents_required,
    compute_fields_required,
    compute_flag_required,
    compute_images_required,
    compute_name_required,
    compute_objectives_required,
    compute_parameters_required,
    compute_personas_required,
    compute_problem_statement_required,
    compute_questions_required,
    compute_show_departments,
    compute_show_description,
    compute_show_documents,
    compute_show_fields,
    compute_show_flag,
    compute_show_images,
    compute_show_name,
    compute_show_objectives,
    compute_show_parameters,
    compute_show_personas,
    compute_show_problem_statement,
    compute_show_questions,
    compute_show_videos,
    compute_videos_required,
    has_access,
)
from app.api.v4.artifacts.scenario.types import (
    GetScenarioApiRequest,
    GetScenarioApiResponse,
    GetScenarioWebsocketResponse,
    ScenarioDepartmentSection,
    ScenarioDescriptionSection,
    ScenarioDocumentSection,
    ScenarioFlagConfig,
    ScenarioFlagSection,
    ScenarioImageSection,
    ScenarioNameSection,
    ScenarioObjectiveSection,
    ScenarioParameterFieldSection,
    ScenarioParameterSection,
    ScenarioPersonaSection,
    ScenarioProblemStatementSection,
    ScenarioQuestionSection,
    ScenarioResourceBucket,
    ScenarioResources,
    ScenarioVideoSection,
    ScenarioWebsocketResources,
    ScenarioWebsocketViews,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.permissions import resolve_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.documents.search import search_documents_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.images.get import get_images_internal
from app.api.v4.resources.images.search import search_images_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.objectives.get import get_objectives_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameter_fields.search import (
    search_parameter_fields_internal,
)
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.parameters.search import (
    search_conditional_parameters_internal,
    search_parameters_internal,
)
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.personas.search import search_personas_internal
from app.api.v4.resources.problem_statements.get import (
    get_problem_statements_internal,
)
from app.api.v4.resources.problem_statements.search import (
    search_problem_statements_internal,
)
from app.api.v4.resources.questions.get import get_questions_internal
from app.api.v4.resources.questions.search import search_questions_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.resources.videos.get import get_videos_internal
from app.api.v4.resources.videos.search import search_videos_internal
from app.api.v4.views.drafts.get import get_draft_scenario_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetScenarioAccessSqlParams,
    GetScenarioAccessSqlRow,
    GetScenarioIdsSqlParams,
    GetScenarioIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/scenarios/get_scenario_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/scenarios/get_scenario_ids_complete.sql"

router = APIRouter()


# Flag key to label mapping for scenarios
SCENARIO_FLAG_LABELS = {
    "active": "Active",
    "video_enabled": "Video",
    "problem_statement_enabled": "Problem Statement",
    "objectives_enabled": "Objectives",
    "images_enabled": "Images",
    "questions_enabled": "Questions",
}


def derive_scenario_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'scenario_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    # Remove artifact prefix (e.g., 'scenario_active' -> 'active')
    key = name.replace("scenario_", "")
    # Use mapping for label, fallback to title case
    label = SCENARIO_FLAG_LABELS.get(key, key.replace("_", " ").title())
    return (key, label)


def _dedupe_by_id(items: list[Any], id_attr: str) -> list[Any]:
    """Preserve order while deduplicating by id attribute."""
    seen: set[UUID] = set()
    output: list[Any] = []
    for item in items:
        item_id = getattr(item, id_attr, None)
        if item_id and item_id not in seen:
            seen.add(item_id)
            output.append(item)
    return output


# =============================================================================
# Internal Data Layer
# =============================================================================


@dataclass
class ScenarioInternalData:
    """Internal data from core scenario fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_scenario_websocket() - minimal data for WebSocket handlers
    - get_scenario_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    scenario_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Agent mappings
    agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: agent exists for resource)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    content_show_ai_generate: bool

    # Resources payload
    resources_payload: ScenarioResources

    # Per-resource group IDs (from draft MV)
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    tool_ids_map: dict[str, UUID | None]

    # Config resources (for websocket generation context)
    config_agent_resources: list[Any] | None
    config_model_resources: list[Any] | None
    config_provider_resources: list[Any] | None

    # IDs result (for backwards-compat fields in client response)
    ids_result: GetScenarioIdsSqlRow

    # Scenario-specific: video parameter data
    video_param_ids: set[UUID]
    non_video_param_ids: set[UUID]
    persona_to_params: dict[UUID, list[UUID]]
    doc_to_params: dict[UUID, list[UUID]]


async def get_scenario_internal(
    profile_id: UUID,
    scenario_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    # Search terms per resource (only needed for client layer)
    description_search: str | None = None,
    persona_search: str | None = None,
    document_search: str | None = None,
    parameter_search: str | None = None,
    problem_statement_search: str | None = None,
    image_search: str | None = None,
    video_search: str | None = None,
    question_search: str | None = None,
    persona_show_selected: bool | None = None,
    document_show_selected: bool | None = None,
    parameter_show_selected: bool | None = None,
) -> ScenarioInternalData:
    """Core data fetching layer (cacheable).

    Fetches all scenario data using two-pass architecture and returns
    a dataclass with all computed values. This is the shared layer used by:
    - get_scenario_websocket() - minimal data for WebSocket handlers
    - get_scenario_client() - full BFF response for HTTP/frontend

    Args:
        profile_id: The authenticated user's profile ID
        scenario_id: The scenario ID to fetch (None for new scenario mode)
        draft_id: Optional draft ID for draft mode
        bypass_cache: Whether to bypass resource caching

    Returns:
        ScenarioInternalData with all computed values

    Raises:
        HTTPException: For validation errors (404, 403, 400)
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Fetch draft if provided
    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_scenario_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    # Fetch user context for permissions
    async with pool.acquire() as context_conn:
        profile_ctx = await get_auth_profile_internal(
            conn=context_conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )
    user_role = profile_ctx.access.role
    actor_name = profile_ctx.access.actor_name
    user_department_ids = [
        d.department_id for d in profile_ctx.departments if d.department_id
    ]

    # === GROUP ID: Create in Python (moved from SQL side-effect) ===
    if draft_item and draft_item.group_id:
        effective_group_id = draft_item.group_id
    else:
        async with pool.acquire() as c:
            effective_group_id = await c.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
            )

    async with pool.acquire() as conn:
        query1_params = GetScenarioAccessSqlParams(
            profile_id=profile_id,
            scenario_id=scenario_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetScenarioAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        scenario_department_ids = access_result.scenario_department_ids or []
        active_simulation_count = access_result.active_simulation_count or 0

        # Early validation: check scenario exists
        if scenario_id is not None:
            if access_result.scenario_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Scenario {scenario_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, scenario_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this scenario. It may be restricted to other departments.",
                )

        effective_draft_version = draft_item.version if draft_item is not None else None

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetScenarioIdsSqlParams(
            profile_id=profile_id,
            scenario_id=scenario_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetScenarioIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, tool_ids_map_create, _link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, SCENARIO_RESOURCES
    )
    tool_ids_map = tool_ids_map_create

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    show_ai_generate_map = {
        resource: agent_ids.get(resource) is not None for resource in SCENARIO_RESOURCES
    }

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in SCENARIO_BASIC_RESOURCES
    )
    content_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in SCENARIO_CONTENT_RESOURCES
    )

    # === PYTHON BUSINESS LOGIC ===

    # Compute permissions
    can_edit = compute_can_edit(
        user_role=user_role,
        scenario_department_ids=scenario_department_ids,
        active_simulation_count=active_simulation_count,
        user_department_ids=user_department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        scenario_department_ids=scenario_department_ids,
        active_simulation_count=active_simulation_count,
        user_department_ids=user_department_ids,
    )

    # === PASS 2: Parallel Resource Fetching ===

    # Selected IDs for fetching (with draft override support)
    selected_name_ids = [ids_result.name_id] if ids_result.name_id else []
    selected_description_ids = (
        [ids_result.description_id] if ids_result.description_id else []
    )
    selected_problem_statement_ids = (
        [ids_result.problem_statement_id] if ids_result.problem_statement_id else []
    )
    selected_department_ids = ids_result.department_ids or []
    selected_persona_ids = ids_result.persona_ids or []
    selected_document_ids = ids_result.document_ids or []
    selected_parameter_ids = ids_result.parameter_ids or []
    selected_parameter_field_ids = ids_result.parameter_field_ids or []
    selected_objective_ids = ids_result.objective_ids or []
    selected_image_ids = ids_result.image_ids or []
    selected_video_ids = ids_result.video_ids or []
    selected_question_ids = ids_result.question_ids or []

    # Draft values override canonical junction values
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_ids = [draft_item.name_ids[0]]
        if draft_item.description_ids:
            selected_description_ids = [draft_item.description_ids[0]]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids
        if draft_item.persona_ids:
            selected_persona_ids = draft_item.persona_ids
        if draft_item.document_ids:
            selected_document_ids = draft_item.document_ids
        if draft_item.parameter_ids:
            selected_parameter_ids = draft_item.parameter_ids
        if draft_item.parameter_field_ids:
            selected_parameter_field_ids = draft_item.parameter_field_ids
        if draft_item.question_ids:
            selected_question_ids = draft_item.question_ids

    # Build per-resource group_ids from draft_item
    resource_group_ids: dict[str, UUID | None] = {
        "names": draft_item.group_id if draft_item else None,
        "descriptions": draft_item.group_id if draft_item else None,
        "problem_statements": draft_item.group_id if draft_item else None,
        "flags": draft_item.group_id if draft_item else None,
        "departments": draft_item.group_id if draft_item else None,
        "personas": draft_item.group_id if draft_item else None,
        "documents": draft_item.group_id if draft_item else None,
        "parameters": draft_item.group_id if draft_item else None,
        "fields": draft_item.group_id if draft_item else None,
        "objectives": draft_item.group_id if draft_item else None,
        "images": draft_item.group_id if draft_item else None,
        "videos": draft_item.group_id if draft_item else None,
        "questions": draft_item.group_id if draft_item else None,
    }

    # Parallel fetch all resources
    # NOTE: Each query needs its own connection from the pool because
    # asyncpg connections cannot handle concurrent operations.

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names_internal(c, selected_name_ids, bypass_cache)
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                None,
                selected_name_ids,
                bypass_cache,
                scenario=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions():
        async with pool.acquire() as c:
            selected = await get_descriptions_internal(
                c, selected_description_ids, bypass_cache
            )
            suggestions = await search_descriptions_internal(
                c,
                description_search,
                20,
                0,
                effective_group_id,
                "recent",
                selected_description_ids,
                bypass_cache,
                scenario=True,
            )
            return (selected, suggestions)

    async def fetch_problem_statements():
        async with pool.acquire() as c:
            selected = await get_problem_statements_internal(
                c, selected_problem_statement_ids, bypass_cache
            )
            suggestions = await search_problem_statements_internal(
                c,
                problem_statement_search,
                20,
                0,
                selected_problem_statement_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    # Scenario-specific flag names (business logic)
    SCENARIO_FLAG_NAMES = {
        "scenario_active",
        "video_enabled",
        "problem_statement_enabled",
        "objectives_enabled",
        "images_enabled",
        "questions_enabled",
    }

    async def fetch_all_scenario_flags():
        """Fetch ALL available scenario flags, not just selected ones."""
        async with pool.acquire() as c:
            # Get all selected flag IDs to fetch their full data
            all_selected_ids = [
                fid
                for fid in [
                    ids_result.active_flag_id,
                    ids_result.objectives_enabled_flag_id,
                    ids_result.images_enabled_flag_id,
                    ids_result.video_enabled_flag_id,
                    ids_result.questions_enabled_flag_id,
                    ids_result.problem_statement_enabled_flag_id,
                ]
                if fid
            ]
            selected = await get_flags_internal(c, all_selected_ids, bypass_cache)
            # Search for all available scenario flags (by type)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                all_selected_ids,
                bypass_cache=bypass_cache,
                scenario=True,
            )
            # Filter to only scenario-specific flags (business logic in Python)
            suggestions = [f for f in all_flags if f.name in SCENARIO_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(
                c, selected_department_ids, bypass_cache
            )
            dept_source = "all" if scenario_id is None else "recent"
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source=dept_source,
                exclude_ids=selected_department_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_personas():
        async with pool.acquire() as c:
            selected = await get_personas_internal(
                c, selected_persona_ids, bypass_cache
            )
            suggestions = await search_personas_internal(
                c,
                persona_search,
                20,
                0,
                user_department_ids,
                effective_group_id,
                exclude_ids=selected_persona_ids,
                bypass_cache=bypass_cache,
                scenario=True,
            )
            return (selected, suggestions)

    async def fetch_documents():
        async with pool.acquire() as c:
            selected = await get_documents_internal(
                c, selected_document_ids, bypass_cache
            )
            suggestions = await search_documents_internal(
                c,
                document_search,
                20,
                0,
                user_department_ids,
                effective_group_id,
                exclude_ids=selected_document_ids,
                bypass_cache=bypass_cache,
                scenario=True,
            )
            return (selected, suggestions)

    async def fetch_parameters():
        async with pool.acquire() as c:
            selected = await get_parameters_internal(
                c,
                selected_parameter_ids,
                bypass_cache,
                scenario_parameter=True,
            )
            suggestions = await search_parameters_internal(
                c,
                search=parameter_search,
                limit_count=20,
                offset_count=0,
                persona_parameter=None,
                document_parameter=None,
                scenario_parameter=True,
                video_parameter=None,
                suggest_source="all",
                exclude_ids=selected_parameter_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_parameter_fields(param_ids: list[UUID]):
        async with pool.acquire() as c:
            selected = await get_parameter_fields_internal(
                c, selected_parameter_field_ids, bypass_cache
            )
            available = await search_parameter_fields_internal(
                c, param_ids, bypass_cache=bypass_cache
            )
            return (selected, available)

    async def fetch_objectives():
        async with pool.acquire() as c:
            selected = await get_objectives_internal(
                c, selected_objective_ids, bypass_cache
            )
            return (selected, [])

    async def fetch_images():
        async with pool.acquire() as c:
            selected = await get_images_internal(c, selected_image_ids, bypass_cache)
            suggestions = await search_images_internal(
                c,
                image_search,
                20,
                0,
                selected_image_ids,
                bypass_cache=bypass_cache,
                scenario=True,
            )
            return (selected, suggestions)

    async def fetch_videos():
        async with pool.acquire() as c:
            selected = await get_videos_internal(c, selected_video_ids, bypass_cache)
            suggestions = await search_videos_internal(
                c,
                video_search,
                20,
                0,
                selected_video_ids,
                bypass_cache=bypass_cache,
                scenario=True,
            )
            return (selected, suggestions)

    async def fetch_questions():
        async with pool.acquire() as c:
            selected = await get_questions_internal(
                c, selected_question_ids, bypass_cache
            )
            suggestions = await search_questions_internal(
                c,
                question_search,
                20,
                0,
                selected_question_ids,
                bypass_cache=bypass_cache,
                scenario=True,
            )
            return (selected, suggestions)

    # === TWO-PHASE FETCH ===
    # Phase 1a: Fetch scenario parameters FIRST to get all scenario parameter IDs
    (parameters_selected, parameters_suggestions) = await fetch_parameters()

    # Extract ALL scenario parameter IDs (both selected and available)
    all_scenario_parameter_ids = list(
        {p.parameter_id for p in parameters_selected}
        | {p.parameter_id for p in parameters_suggestions}
    )

    # Phase 1b: Fetch ALL conditional parameters transitively
    async def fetch_conditional_parameters():
        async with pool.acquire() as c:
            return await search_conditional_parameters_internal(
                c,
                [pid for pid in all_scenario_parameter_ids if pid is not None],
                bypass_cache,
            )

    conditional_params = await fetch_conditional_parameters()

    # Combine ALL parameter IDs for Phase 2
    all_parameter_ids = list(
        set(
            all_scenario_parameter_ids
            + [p.parameter_id for p in conditional_params if p.parameter_id]
        )
    )

    # Phase 2: Fetch remaining resources in parallel
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (problem_statements_selected, problem_statements_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (personas_selected, personas_suggestions),
        (documents_selected, documents_suggestions),
        (parameter_fields_selected, parameter_fields_suggestions),
        (objectives_selected, _),
        (images_selected, images_suggestions),
        (videos_selected, videos_suggestions),
        (questions_selected, questions_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_problem_statements(),
        fetch_all_scenario_flags(),
        fetch_departments(),
        fetch_personas(),
        fetch_documents(),
        fetch_parameter_fields([pid for pid in all_parameter_ids if pid is not None]),
        fetch_objectives(),
        fetch_images(),
        fetch_videos(),
        fetch_questions(),
    )

    # === VIDEO PARAMETER COMPUTATION ===
    async with pool.acquire() as filter_conn:
        video_param_rows = await filter_conn.fetch(
            "SELECT id, video_parameter FROM parameters_resource WHERE active = true"
        )
        video_param_ids = {
            row["id"] for row in video_param_rows if row["video_parameter"]
        }
        non_video_param_ids = {
            row["id"] for row in video_param_rows if not row["video_parameter"]
        }

        all_persona_ids_for_video = [
            p.persona_id
            for p in personas_selected + personas_suggestions
            if p.persona_id
        ]
        if all_persona_ids_for_video:
            persona_param_rows = await filter_conn.fetch(
                """SELECT ppj.personas_id as persona_id, ARRAY_AGG(DISTINCT pfr.parameter_id) as param_ids
                   FROM persona_personas_junction ppj
                   JOIN persona_parameter_fields_junction ppfj ON ppfj.persona_id = ppj.persona_id
                   JOIN parameter_fields_resource pfr ON pfr.id = ppfj.parameter_field_id
                   WHERE ppj.personas_id = ANY($1)
                     AND ppj.active = true
                     AND ppfj.active = true
                     AND pfr.active = true
                     AND pfr.parameter_id IS NOT NULL
                   GROUP BY ppj.personas_id""",
                all_persona_ids_for_video,
            )
            persona_to_params = {
                row["persona_id"]: row["param_ids"] or [] for row in persona_param_rows
            }
        else:
            persona_to_params = {}

        all_document_ids_for_video = [
            d.document_id
            for d in documents_selected + documents_suggestions
            if d.document_id
        ]
        if all_document_ids_for_video:
            doc_param_rows = await filter_conn.fetch(
                """SELECT ddj.documents_id as document_id, ARRAY_AGG(dpj.parameter_id) as param_ids
                   FROM document_documents_junction ddj
                   JOIN document_parameters_junction dpj ON dpj.document_id = ddj.document_id
                   WHERE ddj.documents_id = ANY($1)
                     AND ddj.active = true
                     AND dpj.active = true
                   GROUP BY ddj.documents_id""",
                all_document_ids_for_video,
            )
            doc_to_params = {
                row["document_id"]: row["param_ids"] or [] for row in doc_param_rows
            }
        else:
            doc_to_params = {}

    # Combine selected and suggestions (dedupe)
    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    problem_statements = _dedupe_by_id(
        problem_statements_selected + problem_statements_suggestions,
        "problem_statement_id",
    )
    all_scenario_flags = _dedupe_by_id(flags_selected + flags_suggestions, "name")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    personas = _dedupe_by_id(personas_selected + personas_suggestions, "persona_id")
    documents = _dedupe_by_id(documents_selected + documents_suggestions, "document_id")
    parameters = _dedupe_by_id(
        parameters_selected + parameters_suggestions + conditional_params,
        "parameter_id",
    )
    parameter_fields = _dedupe_by_id(
        parameter_fields_selected + parameter_fields_suggestions, "field_id"
    )
    objectives = objectives_selected
    images = _dedupe_by_id(images_selected + images_suggestions, "image_id")
    videos = _dedupe_by_id(videos_selected + videos_suggestions, "video_id")
    questions = _dedupe_by_id(questions_selected + questions_suggestions, "question_id")

    # Compute final show flags
    show_name = compute_show_name()
    show_description = compute_show_description()
    show_problem_statement = compute_show_problem_statement()
    show_flag = compute_show_flag()
    show_departments = compute_show_departments(len(departments))
    show_personas = compute_show_personas(len(personas))
    show_documents = compute_show_documents(len(documents))
    show_parameters = compute_show_parameters(len(parameters))
    show_parameter_fields = compute_show_fields(len(parameter_fields))
    show_objectives = compute_show_objectives(len(objectives))
    show_images = compute_show_images(len(images))
    show_videos = compute_show_videos(len(videos))
    show_questions = compute_show_questions(len(questions))

    show_flags_map = {
        "names": show_name,
        "descriptions": show_description,
        "problem_statements": show_problem_statement,
        "flags": show_flag,
        "departments": show_departments,
        "personas": show_personas,
        "documents": show_documents,
        "parameters": show_parameters,
        "fields": show_parameter_fields,
        "objectives": show_objectives,
        "images": show_images,
        "videos": show_videos,
        "questions": show_questions,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "problem_statements": compute_problem_statement_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "personas": compute_personas_required(),
        "documents": compute_documents_required(),
        "parameters": compute_parameters_required(),
        "fields": compute_fields_required(),
        "objectives": compute_objectives_required(),
        "images": compute_images_required(),
        "videos": compute_videos_required(),
        "questions": compute_questions_required(),
    }

    # Build enriched flags list from ALL available scenario flags
    scenario_flags: list[ScenarioFlagConfig] = [
        ScenarioFlagConfig(
            key=derive_scenario_flag_key_and_label(flag.name)[0],
            label=derive_scenario_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flag,
            required=compute_flag_required(),
            generated=flag.generated,
            video_flag=flag.name == "scenario_questions_enabled",
        )
        for flag in all_scenario_flags
        if flag.id and flag.name and flag.name != "scenario_parameter"
    ]
    scenario_flags.sort(key=lambda f: f.video_flag or False)

    # Helper to compute video flags for personas/documents
    def compute_persona_video_flags(persona_id: UUID | None) -> tuple[bool, bool]:
        if persona_id is None:
            return False, True
        linked_params = persona_to_params.get(persona_id, [])
        has_video_param = any(pid in video_param_ids for pid in linked_params)
        has_non_video_param = (
            any(pid in non_video_param_ids for pid in linked_params)
            or not linked_params
        )
        return has_video_param, has_non_video_param

    def compute_document_video_flags(document_id: UUID | None) -> tuple[bool, bool]:
        if document_id is None:
            return False, True
        linked_params = doc_to_params.get(document_id, [])
        has_video_param = any(pid in video_param_ids for pid in linked_params)
        has_non_video_param = (
            any(pid in non_video_param_ids for pid in linked_params)
            or not linked_params
        )
        return has_video_param, has_non_video_param

    def compute_parameter_non_video_flag(video_parameter: bool | None) -> bool:
        return not video_parameter if video_parameter is not None else True

    # Build resources payload with video flag enrichment
    def _to_dict(item: Any) -> dict[str, Any]:
        if hasattr(item, "model_dump"):
            return item.model_dump()
        return dict(item)

    def _persona_to_dict(persona: Any) -> dict[str, Any]:
        d = _to_dict(persona)
        video_persona, non_video_persona = compute_persona_video_flags(
            persona.persona_id
        )
        d["video_persona"] = video_persona
        d["non_video_persona"] = non_video_persona
        return d

    def _document_to_dict(document: Any) -> dict[str, Any]:
        d = _to_dict(document)
        video_document, non_video_document = compute_document_video_flags(
            document.document_id
        )
        d["video_document"] = video_document
        d["non_video_document"] = non_video_document
        return d

    def _parameter_to_dict(param: Any) -> dict[str, Any]:
        d = _to_dict(param)
        d["non_video_parameter"] = compute_parameter_non_video_flag(
            param.video_parameter
        )
        return d

    # Find selected resources for current bucket
    name_resource = next((n for n in names if n.id in set(selected_name_ids)), None)
    description_resource = next(
        (d for d in descriptions if d.id in set(selected_description_ids)), None
    )
    problem_statement_resource = next(
        (
            ps
            for ps in problem_statements
            if ps.problem_statement_id in set(selected_problem_statement_ids)
        ),
        None,
    )
    department_resources = [
        d for d in departments if d.department_id in set(selected_department_ids)
    ]
    persona_resources = personas_selected
    document_resources = documents_selected
    parameter_resources = [
        p for p in parameters if p.parameter_id in set(selected_parameter_ids)
    ]
    parameter_field_resources = [
        f for f in parameter_fields if f.id in set(selected_parameter_field_ids)
    ]
    objective_resources = objectives_selected
    image_resources = images_selected
    video_resources = videos_selected
    question_resources = questions_selected

    # Build resources payload
    resources_payload = ScenarioResources(
        resources=ScenarioResourceBucket(
            names=[_to_dict(n) for n in names],
            descriptions=[_to_dict(d) for d in descriptions],
            problem_statements=[_to_dict(ps) for ps in problem_statements],
            flags=scenario_flags,
            departments=[_to_dict(d) for d in departments],
            personas=[_persona_to_dict(p) for p in personas],
            documents=[_document_to_dict(d) for d in documents],
            parameters=[_parameter_to_dict(p) for p in parameters],
            parameter_fields=[_to_dict(f) for f in parameter_fields],
            objectives=[_to_dict(o) for o in objectives],
            images=[_to_dict(i) for i in images],
            videos=[_to_dict(v) for v in videos],
            questions=[_to_dict(q) for q in questions],
        ),
        current=ScenarioResourceBucket(
            names=[_to_dict(name_resource)] if name_resource else [],
            descriptions=[_to_dict(description_resource)]
            if description_resource
            else [],
            problem_statements=[_to_dict(problem_statement_resource)]
            if problem_statement_resource
            else [],
            flags=[
                f
                for f in scenario_flags
                if f.flag_option_id
                in {
                    ids_result.active_flag_id,
                    ids_result.objectives_enabled_flag_id,
                    ids_result.images_enabled_flag_id,
                    ids_result.video_enabled_flag_id,
                    ids_result.questions_enabled_flag_id,
                    ids_result.problem_statement_enabled_flag_id,
                }
                - {None}
            ],
            departments=[_to_dict(d) for d in department_resources],
            personas=[_persona_to_dict(p) for p in persona_resources],
            documents=[_document_to_dict(d) for d in document_resources],
            parameters=[_parameter_to_dict(p) for p in parameter_resources],
            parameter_fields=[_to_dict(f) for f in parameter_field_resources],
            objectives=[_to_dict(o) for o in objective_resources],
            images=[_to_dict(i) for i in image_resources],
            videos=[_to_dict(v) for v in video_resources],
            questions=[_to_dict(q) for q in question_resources],
        ),
    )

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": [n.id for n in names_suggestions],
        "descriptions": [d.id for d in descriptions_suggestions],
        "problem_statements": [
            ps.problem_statement_id for ps in problem_statements_suggestions
        ],
        "departments": [d.department_id for d in departments_suggestions],
        "personas": [p.persona_id for p in personas_suggestions],
        "documents": [d.document_id for d in documents_suggestions],
        "parameters": [p.parameter_id for p in parameters_suggestions],
        "objectives": [],
        "images": [i.image_id for i in images_suggestions],
        "videos": [v.video_id for v in videos_suggestions],
        "questions": [q.question_id for q in questions_suggestions],
    }

    # Validation for new mode
    if scenario_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    selected_agent_ids = [aid for aid in agent_ids.values() if aid]
    unique_agent_ids = list(dict.fromkeys(selected_agent_ids))
    config_agents_result: list[Any] = []
    config_models_result: list[Any] = []
    config_providers_result: list[Any] = []
    if unique_agent_ids:
        async with pool.acquire() as c:
            config_agents_result = await get_agents_internal(
                c, unique_agent_ids, bypass_cache
            )
        if config_agents_result:
            model_ids = list(
                {
                    m
                    for agent in config_agents_result
                    for m in [getattr(agent, "model_id", None)]
                    if m is not None
                }
            )
            provider_ids = list(
                {
                    p
                    for agent in config_agents_result
                    for p in [getattr(agent, "provider_id", None)]
                    if p is not None
                }
            )
            if model_ids:
                async with pool.acquire() as c:
                    config_models_result = await get_models_internal(
                        c, model_ids, bypass_cache
                    )
            if provider_ids:
                async with pool.acquire() as c:
                    config_providers_result = await get_providers_internal(
                        c, provider_ids, bypass_cache
                    )

    return ScenarioInternalData(
        # Access/context
        actor_name=actor_name,
        scenario_exists=access_result.scenario_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        # Agent mappings
        agent_ids=agent_ids,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        content_show_ai_generate=content_show_ai_generate,
        # Resources
        resources_payload=resources_payload,
        # Per-resource group IDs
        resource_group_ids=resource_group_ids,
        # Per-resource tool IDs
        tool_ids_map=tool_ids_map,
        # Config resources
        config_agent_resources=config_agents_result or None,
        config_model_resources=config_models_result or None,
        config_provider_resources=config_providers_result or None,
        # IDs result for backwards-compat
        ids_result=ids_result,
        # Video param data
        video_param_ids=video_param_ids,
        non_video_param_ids=non_video_param_ids,
        persona_to_params=persona_to_params,
        doc_to_params=doc_to_params,
    )


# =============================================================================
# WebSocket Layer
# =============================================================================


async def get_scenario_websocket(
    profile_id: UUID,
    scenario_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetScenarioWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns generation context for socket handlers:
    - group_id
    - resource_agent_ids mapping (resource_type -> agent_id)
    - resources payload for Jinja context
    """
    data = await get_scenario_internal(
        profile_id=profile_id,
        scenario_id=scenario_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    draft_view = None
    if draft_id is not None:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")
        async with pool.acquire() as conn:
            draft_items = await get_draft_scenario_internal(
                conn=conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            draft_view = draft_items[0] if draft_items else None

    current = data.resources_payload.current
    selected_flag_ids = {
        getattr(f, "flag_option_id", None) or getattr(f, "id", None)
        for f in (current.flags if current and current.flags else [])
    } - {None}
    all_enriched_flags = (
        data.resources_payload.resources.flags
        if data.resources_payload.resources
        else []
    ) or []
    selected_enriched_flags = [
        f for f in all_enriched_flags if f.flag_option_id in selected_flag_ids
    ]

    tools_result: list[Any] = []
    if data.config_agent_resources:
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            ids = getattr(agent, "tool_ids", None) or []
            tool_ids.extend(ids)
        deduped_tool_ids = list(dict.fromkeys(tool_ids))
        if deduped_tool_ids:
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")
            async with pool.acquire() as conn:
                tools_result = await get_tools_internal(
                    conn, deduped_tool_ids, bypass_cache
                )

    return GetScenarioWebsocketResponse(
        group_id=data.group_id,
        views=ScenarioWebsocketViews(draft_scenario=draft_view) if draft_view else None,
        resource_agent_ids=data.agent_ids,
        resources=ScenarioWebsocketResources(
            names=current.names if current else None,
            descriptions=current.descriptions if current else None,
            problem_statements=current.problem_statements if current else None,
            flags=selected_enriched_flags or None,
            departments=current.departments if current else None,
            personas=current.personas if current else None,
            documents=current.documents if current else None,
            parameters=current.parameters if current else None,
            parameter_fields=current.parameter_fields if current else None,
            objectives=current.objectives if current else None,
            images=current.images if current else None,
            videos=current.videos if current else None,
            questions=current.questions if current else None,
            agents=data.config_agent_resources,
            models=data.config_model_resources,
            providers=data.config_provider_resources,
            tools=tools_result or None,
        ),
    )


# =============================================================================
# Client/BFF Layer
# =============================================================================


async def get_scenario_client(
    profile_id: UUID,
    scenario_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    # Search terms per resource
    description_search: str | None = None,
    persona_search: str | None = None,
    document_search: str | None = None,
    parameter_search: str | None = None,
    problem_statement_search: str | None = None,
    image_search: str | None = None,
    video_search: str | None = None,
    question_search: str | None = None,
    persona_show_selected: bool | None = None,
    document_show_selected: bool | None = None,
    parameter_show_selected: bool | None = None,
) -> GetScenarioApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags in section-based form.
    """
    data = await get_scenario_internal(
        profile_id=profile_id,
        scenario_id=scenario_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        description_search=description_search,
        persona_search=persona_search,
        document_search=document_search,
        parameter_search=parameter_search,
        problem_statement_search=problem_statement_search,
        image_search=image_search,
        video_search=video_search,
        question_search=question_search,
        persona_show_selected=persona_show_selected,
        document_show_selected=document_show_selected,
        parameter_show_selected=parameter_show_selected,
    )

    resources_bucket = data.resources_payload.resources
    current_bucket = data.resources_payload.current

    def section_common(resource_key: str) -> dict[str, Any]:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key, []),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "tool_id": data.tool_ids_map.get(resource_key),
        }

    return GetScenarioApiResponse(
        actor_name=data.actor_name,
        scenario_exists=data.scenario_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        content_show_ai_generate=data.content_show_ai_generate,
        names=ScenarioNameSection(
            resource=(
                current_bucket.names[0]
                if current_bucket and current_bucket.names
                else None
            ),
            resources=(resources_bucket.names if resources_bucket else None),
            **section_common("names"),
        ),
        descriptions=ScenarioDescriptionSection(
            resource=(
                current_bucket.descriptions[0]
                if current_bucket and current_bucket.descriptions
                else None
            ),
            resources=(resources_bucket.descriptions if resources_bucket else None),
            **section_common("descriptions"),
        ),
        problem_statements=ScenarioProblemStatementSection(
            resource=(
                current_bucket.problem_statements[0]
                if current_bucket and current_bucket.problem_statements
                else None
            ),
            resources=(
                resources_bucket.problem_statements if resources_bucket else None
            ),
            **section_common("problem_statements"),
        ),
        flags=ScenarioFlagSection(
            current=(current_bucket.flags if current_bucket else None),
            resources=(resources_bucket.flags if resources_bucket else None),
            **section_common("flags"),
        ),
        departments=ScenarioDepartmentSection(
            current=(current_bucket.departments if current_bucket else None),
            resources=(resources_bucket.departments if resources_bucket else None),
            **section_common("departments"),
        ),
        personas=ScenarioPersonaSection(
            current=(current_bucket.personas if current_bucket else None),
            resources=(resources_bucket.personas if resources_bucket else None),
            **section_common("personas"),
        ),
        documents=ScenarioDocumentSection(
            current=(current_bucket.documents if current_bucket else None),
            resources=(resources_bucket.documents if resources_bucket else None),
            **section_common("documents"),
        ),
        parameters=ScenarioParameterSection(
            current=(current_bucket.parameters if current_bucket else None),
            resources=(resources_bucket.parameters if resources_bucket else None),
            **section_common("parameters"),
        ),
        parameter_fields=ScenarioParameterFieldSection(
            current=(current_bucket.parameter_fields if current_bucket else None),
            resources=(resources_bucket.parameter_fields if resources_bucket else None),
            **section_common("fields"),
        ),
        objectives=ScenarioObjectiveSection(
            current=(current_bucket.objectives if current_bucket else None),
            resources=(resources_bucket.objectives if resources_bucket else None),
            **section_common("objectives"),
        ),
        images=ScenarioImageSection(
            current=(current_bucket.images if current_bucket else None),
            resources=(resources_bucket.images if resources_bucket else None),
            **section_common("images"),
        ),
        videos=ScenarioVideoSection(
            current=(current_bucket.videos if current_bucket else None),
            resources=(resources_bucket.videos if resources_bucket else None),
            **section_common("videos"),
        ),
        questions=ScenarioQuestionSection(
            current=(current_bucket.questions if current_bucket else None),
            resources=(resources_bucket.questions if resources_bucket else None),
            **section_common("questions"),
        ),
    )


# =============================================================================
# Route Handler
# =============================================================================


@router.post(
    "/get",
    response_model=GetScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.get",
            "{{ actor.name }} {% if scenario %}viewed{% else %}opened new{% endif %} scenario{% if scenario %} '{{ scenario.name }}'{% endif %}",
        )
    ],
)
async def get_scenario(
    request: GetScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetScenarioApiResponse:
    """Get scenario information using two-pass architecture.

    This is a thin HTTP wrapper around get_scenario_client().

    Query 1: Access check (user role, departments, scenario state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Call the client (BFF) function
        response_data = await get_scenario_client(
            profile_id=profile_id,
            scenario_id=request.scenario_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            description_search=request.description_search,
            persona_search=request.persona_search,
            document_search=request.document_search,
            parameter_search=request.parameter_search,
            problem_statement_search=request.problem_statement_search,
            image_search=request.image_search,
            video_search=request.video_search,
            question_search=request.question_search,
            persona_show_selected=request.persona_show_selected,
            document_show_selected=request.document_show_selected,
            parameter_show_selected=request.parameter_show_selected,
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = (
                getattr(response_data.names.resource, "name", None)
                if response_data.names and response_data.names.resource
                else None
            )
            if request.scenario_id and current_name:
                audit_ctx["scenario"] = {
                    "name": current_name,
                    "id": str(request.scenario_id),
                }
            audit_set(http_request, **audit_ctx)

        # No global cache for this response - individual resources are cached
        response.headers["X-Cache-Tags"] = "scenarios"
        response.headers["X-Cache-Hit"] = "0"
        response.headers["X-Two-Pass"] = "1"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_scenario",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )


from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.providers.get import get_providers_internal
