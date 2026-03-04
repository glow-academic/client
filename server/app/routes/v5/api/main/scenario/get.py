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

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.scenario.permissions import (
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
from app.routes.v5.api.main.scenario.types import (
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
    ScenarioOptionSection,
    ScenarioParameterFieldSection,
    ScenarioParameterSection,
    ScenarioPersonaSection,
    ScenarioProblemStatementSection,
    ScenarioQuestionSection,
    ScenarioResourceBucket,
    ScenarioResources,
    ScenarioVideoSection,
    ScenarioWebsocketEntries,
    ScenarioWebsocketResources,
)
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.entries.scenario_drafts.get import (
    get_scenario_drafts_entries_internal,
)
from app.routes.v5.tools.resources.agents.get import get_agents_internal
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.departments.get import get_departments_internal
from app.routes.v5.tools.resources.departments.search import search_departments_internal
from app.routes.v5.tools.resources.descriptions.get import get_descriptions_internal
from app.routes.v5.tools.resources.descriptions.search import (
    search_descriptions_internal,
)
from app.routes.v5.tools.resources.documents.get import get_documents_internal
from app.routes.v5.tools.resources.documents.search import search_documents_internal
from app.routes.v5.tools.resources.fields.search import search_fields_internal
from app.routes.v5.tools.resources.flags.get import get_flags_internal
from app.routes.v5.tools.resources.flags.search import search_flags_internal
from app.routes.v5.tools.resources.images.get import get_images_internal
from app.routes.v5.tools.resources.images.search import search_images_internal
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names_internal
from app.routes.v5.tools.resources.objectives.get import get_objectives_internal
from app.routes.v5.tools.resources.options.get import get_options_internal
from app.routes.v5.tools.resources.options.search import search_options_internal
from app.routes.v5.tools.resources.parameter_fields.get import (
    get_parameter_fields_internal,
)
from app.routes.v5.tools.resources.parameter_fields.search import (
    search_parameter_fields_internal,
)
from app.routes.v5.tools.resources.parameters.get import get_parameters_internal
from app.routes.v5.tools.resources.parameters.search import search_parameters_internal
from app.routes.v5.tools.resources.personas.get import get_personas_internal
from app.routes.v5.tools.resources.personas.search import search_personas_internal
from app.routes.v5.tools.resources.problem_statements.get import (
    get_problem_statements_internal,
)
from app.routes.v5.tools.resources.problem_statements.search import (
    search_problem_statements_internal,
)
from app.routes.v5.tools.resources.profiles.get import get_profiles_internal
from app.routes.v5.tools.resources.questions.get import get_questions_internal
from app.routes.v5.tools.resources.questions.search import search_questions_internal
from app.routes.v5.tools.resources.tools.get import get_tools
from app.routes.v5.tools.resources.videos.get import get_videos_internal
from app.routes.v5.tools.resources.videos.search import search_videos_internal
from app.sql.types import (
    GetScenarioAccessSqlParams,
    GetScenarioAccessSqlRow,
    GetScenarioIdsSqlParams,
    GetScenarioIdsSqlRow,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/queries/scenarios/get_scenario_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/scenarios/get_scenario_ids_complete.sql"

router = APIRouter()


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

    # Resolved parameter IDs (derived from saved parameter_fields)
    resolved_parameter_ids: list[str] | None

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
    option_search: str | None = None,
    persona_show_selected: bool | None = None,
    document_show_selected: bool | None = None,
    parameter_show_selected: bool | None = None,
    parameter_ids: list[UUID] | None = None,
    group_id: UUID | None = None,
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
            draft_items = await get_scenario_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
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
    if group_id:
        effective_group_id = group_id
    elif draft_item and draft_item.group_id:
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

    agent_ids, tool_ids_map_create, _link_tool_ids_map = resolve_agents_for_artifact(
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
    selected_option_ids = ids_result.option_ids or []

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
        "options": draft_item.group_id if draft_item else None,
    }

    # Parallel fetch all resources
    # NOTE: Each query needs its own connection from the pool because
    # asyncpg connections cannot handle concurrent operations.

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names(c, selected_name_ids, cache)
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
                c, selected_description_ids, cache
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

    # Scenario-specific flag types (business logic)
    SCENARIO_FLAG_TYPES = {
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
                cache=cache,
                scenario=True,
            )
            # Filter to only scenario-specific flags (business logic in Python)
            suggestions = [f for f in all_flags if f.type in SCENARIO_FLAG_TYPES]
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
                suggest_source="selected" if persona_show_selected else None,
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
                suggest_source="selected" if document_show_selected else None,
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
                suggest_source="selected" if parameter_show_selected else "all",
                exclude_ids=selected_parameter_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_parameter_fields():
        async with pool.acquire() as c:
            selected = await get_parameter_fields_internal(
                c, selected_parameter_field_ids, bypass_cache
            )
            available: list = []
            conditional_param_ids: list[UUID] = []
            if parameter_ids:
                available = await search_parameter_fields_internal(
                    c,
                    parameter_ids=parameter_ids,
                    bypass_cache=bypass_cache,
                )
                conditional_param_ids = list(
                    {
                        UUID(str(f.conditional_parameter_id))
                        for f in available
                        if f.conditional_parameter_id
                    }
                )
            return (selected, available, conditional_param_ids)

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

    async def fetch_options():
        async with pool.acquire() as c:
            selected = await get_options_internal(c, selected_option_ids, bypass_cache)
            suggestions = await search_options_internal(
                c,
                option_search,
                20,
                0,
                selected_option_ids,
                question_ids=selected_question_ids or None,
                bypass_cache=bypass_cache,
                scenario=True,
            )
            return (selected, suggestions)

    # === PARALLEL FETCH ===
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (problem_statements_selected, problem_statements_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (personas_selected, personas_suggestions),
        (documents_selected, documents_suggestions),
        (parameters_selected, parameters_suggestions),
        (
            parameter_fields_selected,
            parameter_fields_suggestions,
            conditional_param_ids,
        ),
        (objectives_selected, _),
        (images_selected, images_suggestions),
        (videos_selected, videos_suggestions),
        (questions_selected, questions_suggestions),
        (options_selected, options_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_problem_statements(),
        fetch_all_scenario_flags(),
        fetch_departments(),
        fetch_personas(),
        fetch_documents(),
        fetch_parameters(),
        fetch_parameter_fields(),
        fetch_objectives(),
        fetch_images(),
        fetch_videos(),
        fetch_questions(),
        fetch_options(),
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

    # === RESOLVE UPLOAD IDs (uploads_resource -> uploads_entry) ===
    all_upload_ids: list[UUID] = []
    for img in images_selected + images_suggestions:
        if img.upload_id:
            all_upload_ids.append(img.upload_id)
    for vid in videos_selected + videos_suggestions:
        if vid.upload_id:
            all_upload_ids.append(vid.upload_id)
    for doc in documents_selected + documents_suggestions:
        if doc.upload_id:
            all_upload_ids.append(doc.upload_id)

    upload_id_map: dict[UUID, UUID] = {}
    if all_upload_ids:
        async with pool.acquire() as c:
            rows = await c.fetch(
                "SELECT id, upload_id FROM uploads_resource WHERE id = ANY($1) AND upload_id IS NOT NULL",
                list(set(all_upload_ids)),
            )
            for row in rows:
                upload_id_map[row["id"]] = row["upload_id"]

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
        parameters_selected + parameters_suggestions,
        "parameter_id",
    )

    # Fetch conditional parameter metadata for any referenced by available fields
    # but not already in the parameter list
    existing_param_ids = {p.parameter_id for p in parameters if p.parameter_id}
    missing_conditional_ids = [
        pid for pid in conditional_param_ids if pid not in existing_param_ids
    ]
    if missing_conditional_ids:
        async with pool.acquire() as c:
            conditional_params = await get_parameters_internal(
                c, missing_conditional_ids, bypass_cache
            )
            parameters = _dedupe_by_id(parameters + conditional_params, "parameter_id")
    parameter_fields = _dedupe_by_id(
        parameter_fields_selected + parameter_fields_suggestions, "field_id"
    )
    objectives = objectives_selected
    images = _dedupe_by_id(images_selected + images_suggestions, "image_id")
    videos = _dedupe_by_id(videos_selected + videos_suggestions, "video_id")
    questions = _dedupe_by_id(questions_selected + questions_suggestions, "question_id")
    options = _dedupe_by_id(options_selected + options_suggestions, "option_id")

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
    show_options = len(options) > 0

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
        "options": show_options,
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
        "options": False,
    }

    # Build enriched flags list from ALL available scenario flags (canonical pattern)
    scenario_flags: list[ScenarioFlagConfig] = [
        ScenarioFlagConfig(
            key=flag.type,
            label=flag.name,
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            generated=flag.generated,
            video_flag=flag.type == "questions_enabled",
        )
        for flag in all_scenario_flags
        if flag.id and flag.type and flag.type != "scenario_parameter"
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

    def _image_to_dict(image: Any) -> dict[str, Any]:
        d = _to_dict(image)
        if image.upload_id and image.upload_id in upload_id_map:
            d["upload_id"] = upload_id_map[image.upload_id]
        return d

    def _video_to_dict(video: Any) -> dict[str, Any]:
        d = _to_dict(video)
        if video.upload_id and video.upload_id in upload_id_map:
            d["upload_id"] = upload_id_map[video.upload_id]
        return d

    def _document_to_dict(document: Any) -> dict[str, Any]:
        d = _to_dict(document)
        video_document, non_video_document = compute_document_video_flags(
            document.document_id
        )
        d["video_document"] = video_document
        d["non_video_document"] = non_video_document
        if document.upload_id and document.upload_id in upload_id_map:
            d["upload_id"] = upload_id_map[document.upload_id]
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
    option_resources = options_selected

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
            images=[_image_to_dict(i) for i in images],
            videos=[_video_to_dict(v) for v in videos],
            questions=[_to_dict(q) for q in questions],
            options=[_to_dict(o) for o in options],
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
            images=[_image_to_dict(i) for i in image_resources],
            videos=[_video_to_dict(v) for v in video_resources],
            questions=[_to_dict(q) for q in question_resources],
            options=[_to_dict(o) for o in option_resources],
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
        "options": [o.option_id for o in options_suggestions],
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
            if model_ids:
                async with pool.acquire() as c:
                    config_models_result = await get_models_internal(
                        c, model_ids, bypass_cache
                    )
            provider_ids = list(
                dict.fromkeys(
                    m.provider_id
                    for m in config_models_result
                    if getattr(m, "provider_id", None) is not None
                )
            )
            if provider_ids:
                async with pool.acquire() as c:
                    config_providers_result = await get_providers_internal(
                        c, provider_ids, bypass_cache
                    )

    # Compute resolved_parameter_ids from saved parameter_fields
    resolved_parameter_ids = list(
        {str(pf.parameter_id) for pf in parameter_field_resources if pf.parameter_id}
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
        # Resolved parameter IDs
        resolved_parameter_ids=resolved_parameter_ids or None,
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
    # Search/filter kwargs (from artifact tool calls)
    description_search: str | None = None,
    persona_search: str | None = None,
    document_search: str | None = None,
    parameter_search: str | None = None,
    problem_statement_search: str | None = None,
    image_search: str | None = None,
    video_search: str | None = None,
    question_search: str | None = None,
    option_search: str | None = None,
    persona_show_selected: bool | None = None,
    document_show_selected: bool | None = None,
    parameter_show_selected: bool | None = None,
    parameter_ids: list[UUID] | None = None,
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
        description_search=description_search,
        persona_search=persona_search,
        document_search=document_search,
        parameter_search=parameter_search,
        problem_statement_search=problem_statement_search,
        image_search=image_search,
        video_search=video_search,
        question_search=question_search,
        option_search=option_search,
        persona_show_selected=persona_show_selected,
        document_show_selected=document_show_selected,
        parameter_show_selected=parameter_show_selected,
        parameter_ids=parameter_ids,
    )

    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    async def fetch_draft():
        if not draft_id:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_scenario_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            return draft_items[0] if draft_items else None

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

    async def fetch_tools():
        if not data.config_agent_resources:
            return []
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            ids = getattr(agent, "tool_ids", None) or []
            tool_ids.extend(ids)
        deduped_tool_ids = list(dict.fromkeys(tool_ids))
        if not deduped_tool_ids:
            return []
        async with pool.acquire() as conn:
            return await get_tools(conn, deduped_tool_ids, cache)

    async def fetch_fields():
        async with pool.acquire() as c:
            return await search_fields_internal(
                c,
                search=None,
                limit_count=200,
                offset_count=0,
                department_ids=None,
                cache=cache,
            )

    (
        draft_view,
        config_profile_result,
        runs_result,
        tools_result,
        fields_catalog,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
        fetch_fields(),
    )

    all_resources = data.resources_payload.resources

    # Enrich tools with args and args_outputs
    config_tools = tools_result or []
    config_args = None
    config_args_outputs = None
    if config_tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)
        if all_args_ids or all_args_output_ids:

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args(
                        c, list(set(all_args_ids)), cache=cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c, list(set(all_args_output_ids)), cache=cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    # Build entries (always construct — both fields optional now)
    entries = ScenarioWebsocketEntries(
        draft_scenario=draft_view,
        runs=runs_result,
    )

    return GetScenarioWebsocketResponse(
        group_id=data.group_id,
        entries=entries if draft_view or runs_result else None,
        resource_agent_ids=data.agent_ids,
        resources=ScenarioWebsocketResources(
            names=all_resources.names if all_resources else None,
            descriptions=all_resources.descriptions if all_resources else None,
            problem_statements=all_resources.problem_statements
            if all_resources
            else None,
            flags=all_resources.flags if all_resources else None,
            departments=all_resources.departments if all_resources else None,
            personas=all_resources.personas if all_resources else None,
            documents=all_resources.documents if all_resources else None,
            parameters=all_resources.parameters if all_resources else None,
            parameter_fields=all_resources.parameter_fields if all_resources else None,
            objectives=all_resources.objectives if all_resources else None,
            images=all_resources.images if all_resources else None,
            videos=all_resources.videos if all_resources else None,
            questions=all_resources.questions if all_resources else None,
            options=all_resources.options if all_resources else None,
            fields=fields_catalog,
        ),
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetScenarioApiRequest(
            scenario_id=scenario_id,
            draft_id=draft_id,
            description_search=description_search,
            persona_search=persona_search,
            document_search=document_search,
            parameter_search=parameter_search,
            problem_statement_search=problem_statement_search,
            image_search=image_search,
            video_search=video_search,
            question_search=question_search,
            option_search=option_search,
            persona_show_selected=persona_show_selected,
            document_show_selected=document_show_selected,
            parameter_show_selected=parameter_show_selected,
            parameter_ids=parameter_ids,
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
    option_search: str | None = None,
    persona_show_selected: bool | None = None,
    document_show_selected: bool | None = None,
    parameter_show_selected: bool | None = None,
    parameter_ids: list[UUID] | None = None,
    group_id: UUID | None = None,
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
        option_search=option_search,
        persona_show_selected=persona_show_selected,
        document_show_selected=document_show_selected,
        parameter_show_selected=parameter_show_selected,
        parameter_ids=parameter_ids,
        group_id=group_id,
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
        resolved_parameter_ids=data.resolved_parameter_ids or None,
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
        options=ScenarioOptionSection(
            current=(current_bucket.options if current_bucket else None),
            resources=(resources_bucket.options if resources_bucket else None),
            **section_common("options"),
        ),
    )


# =============================================================================
# Route Handler
# =============================================================================


@router.post("/get", response_model=GetScenarioApiResponse)
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
    cache = None if bypass_cache else (get_cached, set_cached)

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
            option_search=request.option_search,
            persona_show_selected=request.persona_show_selected,
            document_show_selected=request.document_show_selected,
            parameter_show_selected=request.parameter_show_selected,
            parameter_ids=[UUID(str(pid)) for pid in request.parameter_ids]
            if request.parameter_ids
            else None,
            group_id=request.group_id,
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
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )


from app.routes.v5.tools.resources.models.get import get_models_internal
from app.routes.v5.tools.resources.providers.get import get_providers_internal
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
