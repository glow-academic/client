"""Scenario get endpoint - Two-pass architecture.

This implements the refactored two-pass approach:
1. Query 1: Access check (user context, scenario state)
2. Query 2: ID fetching (resource IDs, agents metadata)
3. Pass 2: Parallel resource fetching (per-resource caching)

Business logic (permissions, UI flags) is computed in Python.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.scenario.permissions import (
    compute_can_edit,
    compute_disabled_reason,
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
    compute_show_templates,
    compute_show_videos,
    compute_departments_required,
    compute_description_required,
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
    compute_templates_required,
    compute_videos_required,
    has_access,
)
from app.api.v4.artifacts.scenario.types import (
    GetScenarioApiRequest,
    GetScenarioApiResponse,
    ScenarioFlagConfig,
)
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameter_fields.search import search_parameter_fields_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.images.get import get_images_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.objectives.get import get_objectives_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.parameters.search import (
    search_conditional_parameters_internal,
    search_parameters_internal,
)
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.problem_statements.get import get_problem_statements_internal
from app.api.v4.resources.questions.get import get_questions_internal
from app.api.v4.resources.templates.get import get_templates_internal
from app.api.v4.resources.videos.get import get_videos_internal
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
    "use_templates": "Templates",
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


@dataclass
class CandidateAgent:
    """Represents a candidate agent for resource selection."""

    agent_id: UUID
    agent_name: str
    tool_resources: set[str]
    department_ids: set[UUID]
    updated_at: Any
    is_active: bool
    is_mcp: bool


# Resource sets for scenario agent selection
SCENARIO_RESOURCES = {
    "names",
    "descriptions",
    "problem_statements",
    "objectives",
    "flags",
    "images",
    "videos",
    "questions",
    "departments",
    "fields",
    "personas",
    "documents",
    "parameters",
    "templates",
}

SCENARIO_BASIC_RESOURCES = {
    "names",
    "descriptions",
    "flags",
    "departments",
}

SCENARIO_CONTENT_RESOURCES = {
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
}


def _score_agent(
    agent: CandidateAgent,
    artifact_resources: set[str],
    user_department_ids: set[UUID] | None,
) -> tuple[int, int, int, Any]:
    """Score an agent for artifact selection.

    Returns tuple for sorting: (coverage, -extra_resources, dept_match, updated_at)
    Higher is better.
    """
    # How many artifact resources does this agent cover?
    coverage = len(agent.tool_resources & artifact_resources)

    # Fewer extra resources = more specialist = better (negative for sorting)
    extra = len(agent.tool_resources - artifact_resources)

    # Department match bonus
    dept_match = 0
    if user_department_ids and agent.department_ids:
        dept_match = len(agent.department_ids & user_department_ids)

    return (coverage, -extra, dept_match, agent.updated_at)


def _select_best_agent(
    candidates: list[CandidateAgent],
    required_resources: set[str],
    artifact_resources: set[str],
    user_department_ids: set[UUID] | None,
) -> UUID | None:
    """Select an agent that has tools for ALL required_resources."""
    eligible = [
        agent
        for agent in candidates
        if agent.is_active and required_resources.issubset(agent.tool_resources)
    ]

    if not eligible:
        return None

    scored = sorted(
        eligible,
        key=lambda a: _score_agent(a, artifact_resources, user_department_ids),
        reverse=True,
    )

    return scored[0].agent_id if scored else None


def _select_single_resource_agent(
    candidates: list[CandidateAgent],
    resource: str,
    artifact_resources: set[str],
    user_department_ids: set[UUID] | None,
) -> UUID | None:
    """Select an agent with a single resource tool."""
    return _select_best_agent(
        candidates, {resource}, artifact_resources, user_department_ids
    )


@dataclass
class ScenarioGenerationContext:
    """Context needed for scenario generation."""

    group_id: UUID | None
    name_agent_id: UUID | None
    description_agent_id: UUID | None
    basic_agent_id: UUID | None
    content_agent_id: UUID | None
    general_agent_id: UUID | None
    # Resource IDs organized by type
    resource_ids: dict[str, list[UUID]]


async def get_scenario_generation_context(
    conn: asyncpg.Connection,
    profile_id: UUID,
    scenario_id: UUID | None,
    draft_id: UUID | None = None,
) -> ScenarioGenerationContext | None:
    """Get minimal context needed for scenario generation.

    This is used by generate.py to get agent IDs and resource IDs
    without fetching full resource data.

    Args:
        conn: Database connection
        profile_id: Profile ID making the request
        scenario_id: Scenario ID (for existing scenario)
        draft_id: Draft ID (for draft scenario)

    Returns:
        ScenarioGenerationContext with agent IDs and resource IDs,
        or None if access denied
    """
    # Query 1: Access check
    query1_params = GetScenarioAccessSqlParams(
        profile_id=profile_id,
        scenario_id=scenario_id,
        draft_id=draft_id,
    )

    access_result = cast(
        GetScenarioAccessSqlRow,
        await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
    )

    # Extract user context
    user_role = access_result.user_role
    user_department_ids = access_result.user_department_ids or []
    scenario_department_ids = access_result.scenario_department_ids or []

    # Check access
    if scenario_id is not None:
        if access_result.scenario_exists is False:
            return None

        if not has_access(user_role, user_department_ids, scenario_department_ids):
            return None

    # Query 2: IDs + candidate_agents
    query2_params = GetScenarioIdsSqlParams(
        profile_id=profile_id,
        scenario_id=scenario_id,
        draft_id=draft_id,
        group_id=access_result.group_id,
        user_department_ids=user_department_ids,
    )

    ids_result = cast(
        GetScenarioIdsSqlRow,
        await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
    )

    # Parse candidate_agents
    candidate_agents = [
        CandidateAgent(
            agent_id=ca["agent_id"],
            agent_name=ca["agent_name"],
            tool_resources=set(ca["tool_resources"] or []),
            department_ids=set(ca["department_ids"] or []),
            updated_at=ca["updated_at"],
            is_active=True,
            is_mcp=ca["is_mcp"] or False,
        )
        for ca in (ids_result.candidate_agents or [])
    ]

    # Select agents
    user_dept_set = set(user_department_ids) if user_department_ids else None

    name_agent_id = _select_single_resource_agent(
        candidate_agents, "names", SCENARIO_RESOURCES, user_dept_set
    )
    description_agent_id = _select_single_resource_agent(
        candidate_agents, "descriptions", SCENARIO_RESOURCES, user_dept_set
    )
    basic_agent_id = _select_best_agent(
        candidate_agents, SCENARIO_BASIC_RESOURCES, SCENARIO_RESOURCES, user_dept_set
    )
    content_agent_id = _select_best_agent(
        candidate_agents, SCENARIO_CONTENT_RESOURCES, SCENARIO_RESOURCES, user_dept_set
    )
    general_agent_id = _select_best_agent(
        candidate_agents, SCENARIO_RESOURCES, SCENARIO_RESOURCES, user_dept_set
    )

    # Build resource IDs dict
    resource_ids: dict[str, list[UUID]] = {
        "names": [ids_result.name_id] if ids_result.name_id else [],
        "descriptions": [ids_result.description_id] if ids_result.description_id else [],
        "problem_statements": [ids_result.problem_statement_id] if ids_result.problem_statement_id else [],
        "objectives": ids_result.objective_ids or [],
        "departments": ids_result.department_ids or [],
        "fields": ids_result.parameter_field_ids or [],
        "personas": ids_result.persona_ids or [],
        "documents": ids_result.document_ids or [],
        "parameters": ids_result.parameter_ids or [],
        "templates": ids_result.template_ids or [],
        "images": ids_result.image_ids or [],
        "videos": ids_result.video_ids or [],
        "questions": ids_result.question_ids or [],
    }

    return ScenarioGenerationContext(
        group_id=access_result.group_id,
        name_agent_id=name_agent_id,
        description_agent_id=description_agent_id,
        basic_agent_id=basic_agent_id,
        content_agent_id=content_agent_id,
        general_agent_id=general_agent_id,
        resource_ids=resource_ids,
    )


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

    Query 1: Access check (user role, departments, scenario state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query = load_sql_query(QUERY1_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # === QUERY 1: Access Check (always fresh, no cache) ===
        query1_params = GetScenarioAccessSqlParams(
            profile_id=profile_id,
            scenario_id=request.scenario_id,
            draft_id=request.draft_id,
        )
        sql_params = query1_params.to_tuple()

        access_result = cast(
            GetScenarioAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        scenario_department_ids = access_result.scenario_department_ids or []
        active_simulation_count = access_result.active_simulation_count or 0

        # Early validation: check scenario exists
        if request.scenario_id is not None:
            if access_result.scenario_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Scenario {request.scenario_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, scenario_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this scenario. It may be restricted to other departments.",
                )

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetScenarioIdsSqlParams(
            profile_id=profile_id,
            scenario_id=request.scenario_id,
            draft_id=request.draft_id,
            group_id=access_result.group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetScenarioIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

        # === PYTHON BUSINESS LOGIC ===

        # Compute permissions
        can_edit = compute_can_edit(
            user_role=user_role,
            scenario_department_ids=scenario_department_ids,
            usage_count=active_simulation_count,
        )

        disabled_reason = compute_disabled_reason(
            user_role=user_role,
            scenario_department_ids=scenario_department_ids,
            usage_count=active_simulation_count,
        )

        # === PASS 2: Parallel Resource Fetching (each endpoint handles own cache) ===

        # Selected IDs for fetching
        name_ids = [ids_result.name_id] if ids_result.name_id else []
        description_ids = [ids_result.description_id] if ids_result.description_id else []
        problem_statement_ids = [ids_result.problem_statement_id] if ids_result.problem_statement_id else []
        active_flag_ids = [ids_result.active_flag_id] if ids_result.active_flag_id else []
        objectives_enabled_flag_ids = [ids_result.objectives_enabled_flag_id] if ids_result.objectives_enabled_flag_id else []
        images_enabled_flag_ids = [ids_result.images_enabled_flag_id] if ids_result.images_enabled_flag_id else []
        video_enabled_flag_ids = [ids_result.video_enabled_flag_id] if ids_result.video_enabled_flag_id else []
        questions_enabled_flag_ids = [ids_result.questions_enabled_flag_id] if ids_result.questions_enabled_flag_id else []
        problem_statement_enabled_flag_ids = [ids_result.problem_statement_enabled_flag_id] if ids_result.problem_statement_enabled_flag_id else []
        use_templates_flag_ids = [ids_result.use_templates_flag_id] if ids_result.use_templates_flag_id else []
        department_ids = ids_result.department_ids or []
        # For new scenario, use user's departments if scenario has none
        if request.scenario_id is None and not department_ids and user_department_ids:
            department_ids = user_department_ids
        persona_ids = ids_result.persona_ids or []
        document_ids = ids_result.document_ids or []
        parameter_ids = ids_result.parameter_ids or []
        parameter_field_ids = ids_result.parameter_field_ids or []
        objective_ids = ids_result.objective_ids or []
        image_ids = ids_result.image_ids or []
        video_ids = ids_result.video_ids or []
        question_ids = ids_result.question_ids or []
        template_ids = ids_result.template_ids or []

        # Parallel fetch all resources
        # NOTE: Each query needs its own connection from the pool because
        # asyncpg connections cannot handle concurrent operations.
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        async def fetch_names():
            async with pool.acquire() as c:
                selected = await get_names_internal(c, name_ids, bypass_cache)
                suggestions = await search_names_internal(
                    c,
                    None,
                    20,
                    0,
                    access_result.group_id,
                    "recent",
                    name_ids,
                    bypass_cache,
                )
                return (selected, suggestions)

        async def fetch_descriptions():
            async with pool.acquire() as c:
                selected = await get_descriptions_internal(c, description_ids, bypass_cache)
                suggestions = await search_descriptions_internal(
                    c,
                    request.description_search,
                    20,
                    0,
                    access_result.group_id,
                    "recent",
                    description_ids,
                    bypass_cache,
                )
                return (selected, suggestions)

        async def fetch_problem_statements():
            async with pool.acquire() as c:
                selected = await get_problem_statements_internal(c, problem_statement_ids, bypass_cache)
                # No search endpoint for problem_statements - return empty suggestions
                return (selected, [])

        async def fetch_all_scenario_flags():
            """Fetch ALL available scenario flags, not just selected ones."""
            async with pool.acquire() as c:
                # Get all selected flag IDs to fetch their full data
                all_selected_ids = [
                    fid for fid in [
                        ids_result.active_flag_id,
                        ids_result.objectives_enabled_flag_id,
                        ids_result.images_enabled_flag_id,
                        ids_result.video_enabled_flag_id,
                        ids_result.questions_enabled_flag_id,
                        ids_result.problem_statement_enabled_flag_id,
                        ids_result.use_templates_flag_id,
                    ] if fid
                ]
                selected = await get_flags_internal(c, all_selected_ids, bypass_cache)
                # Search for all available scenario flags
                suggestions = await search_flags_internal(
                    c,
                    None,
                    20,
                    0,
                    all_selected_ids,
                    bypass_cache,
                    artifact_type="scenario",
                )
                return (selected, suggestions)

        async def fetch_departments():
            async with pool.acquire() as c:
                selected = await get_departments_internal(c, department_ids, bypass_cache)
                dept_source = "all" if request.scenario_id is None else "recent"
                suggestions = await search_departments_internal(
                    c,
                    None,
                    20,
                    0,
                    user_department_ids,
                    dept_source,
                    department_ids,
                    bypass_cache,
                )
                return (selected, suggestions)

        async def fetch_personas():
            async with pool.acquire() as c:
                selected = await get_personas_internal(c, persona_ids, bypass_cache)
                # No search endpoint for personas - return empty suggestions
                return (selected, [])

        async def fetch_documents():
            async with pool.acquire() as c:
                selected = await get_documents_internal(c, document_ids, bypass_cache)
                # No search endpoint for documents - return empty suggestions
                return (selected, [])

        async def fetch_parameters():
            async with pool.acquire() as c:
                selected = await get_parameters_internal(
                    c,
                    parameter_ids,
                    bypass_cache,
                    scenario_parameter=True,
                )
                suggestions = await search_parameters_internal(
                    c,
                    request.parameter_search,
                    20,
                    0,
                    None,
                    None,
                    True,
                    None,
                    "all",
                    parameter_ids,
                    bypass_cache,
                )
                return (selected, suggestions)

        async def fetch_parameter_fields(param_ids: list[UUID]):
            async with pool.acquire() as c:
                selected = await get_parameter_fields_internal(c, parameter_field_ids, bypass_cache)
                # Get all available fields for ALL parameters (scenario + conditional)
                # This enables instant UI when user selects a parameter
                available = await search_parameter_fields_internal(c, param_ids, bypass_cache)
                return (selected, available)

        async def fetch_objectives():
            async with pool.acquire() as c:
                selected = await get_objectives_internal(c, objective_ids, bypass_cache)
                # No search endpoint for objectives - return empty suggestions
                return (selected, [])

        async def fetch_images():
            async with pool.acquire() as c:
                selected = await get_images_internal(c, image_ids, bypass_cache)
                # No search endpoint for images - return empty suggestions
                return (selected, [])

        async def fetch_videos():
            async with pool.acquire() as c:
                selected = await get_videos_internal(c, video_ids, bypass_cache)
                # No search endpoint for videos - return empty suggestions
                return (selected, [])

        async def fetch_questions():
            async with pool.acquire() as c:
                selected = await get_questions_internal(c, question_ids, bypass_cache)
                # No search endpoint for questions - return empty suggestions
                return (selected, [])

        async def fetch_templates():
            async with pool.acquire() as c:
                selected = await get_templates_internal(c, template_ids, bypass_cache)
                # No search endpoint for templates - return empty suggestions
                return (selected, [])

        # === TWO-PHASE FETCH ===
        # Phase 1a: Fetch scenario parameters FIRST to get all scenario parameter IDs
        # This is needed because parameter_fields needs to know which parameters to scope to
        (parameters_selected, parameters_suggestions) = await fetch_parameters()

        # Extract ALL scenario parameter IDs (both selected and available)
        all_scenario_parameter_ids = list(
            {p.parameter_id for p in parameters_selected}
            | {p.parameter_id for p in parameters_suggestions}
        )

        # Phase 1b: Fetch ALL conditional parameters transitively
        # This uses a recursive approach to find the full chain
        async def fetch_conditional_parameters():
            async with pool.acquire() as c:
                return await search_conditional_parameters_internal(
                    c, [pid for pid in all_scenario_parameter_ids if pid is not None], bypass_cache
                )

        conditional_params = await fetch_conditional_parameters()

        # Combine ALL parameter IDs for Phase 2 (includes transitive conditional params)
        all_parameter_ids = list(set(
            all_scenario_parameter_ids + [p.parameter_id for p in conditional_params if p.parameter_id]
        ))

        # Phase 2: Fetch remaining resources in parallel (including parameter_fields with proper IDs)
        (
            (names_selected, names_suggestions),
            (descriptions_selected, descriptions_suggestions),
            (problem_statements_selected, _),
            (flags_selected, flags_suggestions),
            (departments_selected, departments_suggestions),
            (personas_selected, _),
            (documents_selected, _),
            (parameter_fields_selected, parameter_fields_suggestions),
            (objectives_selected, _),
            (images_selected, _),
            (videos_selected, _),
            (questions_selected, _),
            (templates_selected, _),
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
            fetch_templates(),
        )

        # Combine selected and suggestions (dedupe)
        names = _dedupe_by_id(names_selected + names_suggestions, "id")
        descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
        problem_statements = problem_statements_selected  # No suggestions
        all_scenario_flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
        departments = _dedupe_by_id(departments_selected + departments_suggestions, "department_id")
        personas = personas_selected  # No suggestions
        documents = documents_selected  # No suggestions
        # Combine scenario parameters with conditional parameters (conditional params have conditional=true)
        parameters = _dedupe_by_id(
            parameters_selected + parameters_suggestions + conditional_params,
            "parameter_id"
        )
        # Dedupe by field_id since selected resources use parameter_fields_resource.id
        # while available fields use field_id as their id
        parameter_fields = _dedupe_by_id(parameter_fields_selected + parameter_fields_suggestions, "field_id")
        objectives = objectives_selected  # No suggestions
        images = images_selected  # No suggestions
        videos = videos_selected  # No suggestions
        questions = questions_selected  # No suggestions
        templates = templates_selected  # No suggestions

        # Find selected resources
        name_resource = next(
            (n for n in names if n.id == ids_result.name_id), None
        )
        description_resource = next(
            (d for d in descriptions if d.id == ids_result.description_id),
            None,
        )
        problem_statement_resource = next(
            (ps for ps in problem_statements if ps.problem_statement_id == ids_result.problem_statement_id),
            None,
        )
        # Find flag resources from all available scenario flags by name
        def find_flag_by_name(name_suffix: str):
            """Find a flag by name suffix (e.g., 'active' -> 'scenario_active')"""
            target_name = f"scenario_{name_suffix}"
            return next((f for f in all_scenario_flags if f.name == target_name), None)

        active_flag_resource = find_flag_by_name("active")
        objectives_enabled_flag_resource = find_flag_by_name("objectives_enabled")
        images_enabled_flag_resource = find_flag_by_name("images_enabled")
        video_enabled_flag_resource = find_flag_by_name("video_enabled")
        questions_enabled_flag_resource = find_flag_by_name("questions_enabled")
        problem_statement_enabled_flag_resource = find_flag_by_name("problem_statement_enabled")
        use_templates_flag_resource = find_flag_by_name("use_templates")

        # Selected multi-select resources
        department_resources = [
            d for d in departments if d.department_id in department_ids
        ]
        persona_resources = personas_selected
        document_resources = documents_selected
        parameter_resources = [
            p for p in parameters if p.parameter_id in parameter_ids
        ]
        parameter_field_resources = [
            f for f in parameter_fields if f.id in parameter_field_ids
        ]
        objective_resources = objectives_selected
        image_resources = images_selected
        video_resources = videos_selected
        question_resources = questions_selected
        template_resources = templates_selected

        # Suggestion IDs
        name_suggestions_ids = [n.id for n in names_suggestions]
        description_suggestions_ids = [d.id for d in descriptions_suggestions]
        department_suggestions_ids = [d.department_id for d in departments_suggestions]
        parameter_suggestions_ids = [p.parameter_id for p in parameters_suggestions]

        # Compute final show flags based on actual data
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
        show_templates = compute_show_templates(len(templates))

        # Build enriched flags list from ALL available scenario flags
        # This ensures flags are shown even when not yet selected
        scenario_flags: list[ScenarioFlagConfig] = [
            ScenarioFlagConfig(
                key=derive_scenario_flag_key_and_label(flag.name)[0],
                label=derive_scenario_flag_key_and_label(flag.name)[1],
                description=flag.description,
                icon_id=flag.icon,
                flag_option_id=flag.id,
                show=show_flag,
                required=compute_flag_required(),
                agent_id=None,
                generated=flag.generated,
            )
            for flag in all_scenario_flags
            if flag.id and flag.name and flag.name != "scenario_parameter"  # Exclude non-UI flags
        ]

        # Set audit context
        if access_result.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": access_result.actor_name, "id": profile_id}
            }
            if request.scenario_id and name_resource and name_resource.name:
                audit_ctx["scenario"] = {
                    "name": name_resource.name,
                    "id": str(request.scenario_id),
                }
            audit_set(http_request, **audit_ctx)

        # Validation for new mode
        if request.scenario_id is None:
            # New mode: check for valid departments
            if not departments:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )

        # === Construct Response ===
        def _to_dict(item: Any) -> dict[str, Any]:
            if hasattr(item, "model_dump"):
                return item.model_dump()
            return dict(item)

        response_data = GetScenarioApiResponse(
            # Required fields
            actor_name=access_result.actor_name,
            scenario_exists=access_result.scenario_exists,
            can_edit=can_edit,
            disabled_reason=disabled_reason,
            group_id=access_result.group_id,
            # Name
            name_id=ids_result.name_id,
            name_resource=_to_dict(name_resource) if name_resource else None,
            show_name=show_name,
            name_agent_id=None,  # Agent IDs computed in Python if needed
            name_required=compute_name_required(),
            name_suggestions=name_suggestions_ids,
            names=[_to_dict(n) for n in names],
            # Description
            description_id=ids_result.description_id,
            description_resource=_to_dict(description_resource) if description_resource else None,
            show_description=show_description,
            description_agent_id=None,
            description_required=compute_description_required(),
            description_suggestions=description_suggestions_ids,
            descriptions=[_to_dict(d) for d in descriptions],
            # Problem statement
            problem_statement_id=ids_result.problem_statement_id,
            problem_statement_resource=_to_dict(problem_statement_resource) if problem_statement_resource else None,
            show_problem_statement=show_problem_statement,
            problem_statement_agent_id=None,
            problem_statement_required=compute_problem_statement_required(),
            problem_statement_suggestions=[],
            problem_statements=[_to_dict(ps) for ps in problem_statements],
            # Active flag
            active_flag_id=ids_result.active_flag_id,
            active_flag_resource=_to_dict(active_flag_resource) if active_flag_resource else None,
            show_active_flag=show_flag,
            active_flag_agent_id=None,
            active_flag_required=compute_flag_required(),
            # Objectives enabled flag
            objectives_enabled_flag_id=ids_result.objectives_enabled_flag_id,
            objectives_enabled_flag_resource=_to_dict(objectives_enabled_flag_resource) if objectives_enabled_flag_resource else None,
            show_objectives_enabled_flag=show_flag,
            objectives_enabled_flag_agent_id=None,
            objectives_enabled_flag_required=compute_flag_required(),
            # Images enabled flag
            images_enabled_flag_id=ids_result.images_enabled_flag_id,
            images_enabled_flag_resource=_to_dict(images_enabled_flag_resource) if images_enabled_flag_resource else None,
            show_images_enabled_flag=show_flag,
            images_enabled_flag_agent_id=None,
            images_enabled_flag_required=compute_flag_required(),
            # Video enabled flag
            video_enabled_flag_id=ids_result.video_enabled_flag_id,
            video_enabled_flag_resource=_to_dict(video_enabled_flag_resource) if video_enabled_flag_resource else None,
            show_video_enabled_flag=show_flag,
            video_enabled_flag_agent_id=None,
            video_enabled_flag_required=compute_flag_required(),
            # Questions enabled flag
            questions_enabled_flag_id=ids_result.questions_enabled_flag_id,
            questions_enabled_flag_resource=_to_dict(questions_enabled_flag_resource) if questions_enabled_flag_resource else None,
            show_questions_enabled_flag=show_flag,
            questions_enabled_flag_agent_id=None,
            questions_enabled_flag_required=compute_flag_required(),
            # Problem statement enabled flag
            problem_statement_enabled_flag_id=ids_result.problem_statement_enabled_flag_id,
            problem_statement_enabled_flag_resource=_to_dict(problem_statement_enabled_flag_resource) if problem_statement_enabled_flag_resource else None,
            show_problem_statement_enabled_flag=show_flag,
            problem_statement_enabled_flag_agent_id=None,
            problem_statement_enabled_flag_required=compute_flag_required(),
            # Use templates flag
            use_templates_flag_id=ids_result.use_templates_flag_id,
            use_templates_flag_resource=_to_dict(use_templates_flag_resource) if use_templates_flag_resource else None,
            show_use_templates_flag=show_flag,
            use_templates_flag_agent_id=None,
            use_templates_flag_required=compute_flag_required(),
            # Server-driven flags array
            flags=scenario_flags,
            show_flags=show_flag,  # Master visibility for all flags
            # Departments
            department_ids=department_ids,
            department_resources=[_to_dict(d) for d in department_resources],
            show_departments=show_departments,
            departments_agent_id=None,
            departments_required=compute_departments_required(),
            department_suggestions=department_suggestions_ids,
            departments=[_to_dict(d) for d in departments],
            # Parameter fields
            parameter_field_ids=parameter_field_ids,
            parameter_field_resources=[_to_dict(f) for f in parameter_field_resources],
            show_parameter_fields=show_parameter_fields,
            parameter_fields_agent_id=None,
            parameter_fields_required=compute_fields_required(),
            parameter_fields=[_to_dict(f) for f in parameter_fields],
            # Objectives
            objective_ids=objective_ids,
            objective_resources=[_to_dict(o) for o in objective_resources],
            show_objectives=show_objectives,
            objectives_agent_id=None,
            objectives_required=compute_objectives_required(),
            objective_suggestions=[],
            objectives=[_to_dict(o) for o in objectives],
            # Images
            image_ids=image_ids,
            image_resources=[_to_dict(i) for i in image_resources],
            show_images=show_images,
            images_agent_id=None,
            images_required=compute_images_required(),
            image_suggestions=[],
            images=[_to_dict(i) for i in images],
            # Videos
            video_ids=video_ids,
            video_resources=[_to_dict(v) for v in video_resources],
            show_videos=show_videos,
            videos_agent_id=None,
            videos_required=compute_videos_required(),
            video_suggestions=[],
            videos=[_to_dict(v) for v in videos],
            # Questions
            question_ids=question_ids,
            question_resources=[_to_dict(q) for q in question_resources],
            show_questions=show_questions,
            questions_agent_id=None,
            questions_required=compute_questions_required(),
            question_suggestions=[],
            questions=[_to_dict(q) for q in questions],
            # Templates
            template_ids=template_ids,
            template_resources=[_to_dict(t) for t in template_resources],
            show_templates=show_templates,
            templates_agent_id=None,
            templates_required=compute_templates_required(),
            template_suggestions=[],
            templates=[_to_dict(t) for t in templates],
            # Personas
            persona_ids=persona_ids,
            persona_resources=[_to_dict(p) for p in persona_resources],
            show_personas=show_personas,
            personas_agent_id=None,
            personas_required=compute_personas_required(),
            persona_suggestions=[],
            personas=[_to_dict(p) for p in personas],
            # Documents
            document_ids=document_ids,
            document_resources=[_to_dict(d) for d in document_resources],
            show_documents=show_documents,
            documents_agent_id=None,
            documents_required=compute_documents_required(),
            document_suggestions=[],
            documents=[_to_dict(d) for d in documents],
            # Parameters
            parameter_ids=parameter_ids,
            parameter_resources=[_to_dict(p) for p in parameter_resources],
            show_parameters=show_parameters,
            parameters_agent_id=None,
            parameters_required=compute_parameters_required(),
            parameter_suggestions=parameter_suggestions_ids,
            parameters=[_to_dict(p) for p in parameters],
            # Multi-resource agent IDs (computed in Python if needed)
            basic_agent_id=None,
            content_agent_id=None,
            general_agent_id=None,
        )

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
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
