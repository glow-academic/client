"""Unified entry point for dashboard artifact.

Provides:
- get_dashboard_internal() — single-pass efficient metrics bundle
- get_dashboard_websocket() — config resources for socket generation
- POST /dashboard/get — HTTP endpoint returning DashboardBundleResponse
"""

import asyncio
from collections import defaultdict
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.chat.permissions import (
    compute_pass_pct,
    compute_score_status,
    compute_show_continue,
    compute_show_view,
)
from app.v5.api.main.dashboard.permissions import (
    compute_footer_metrics_v2,
    compute_header_metrics_v2,
    compute_primary_metrics_v2,
    compute_secondary_metrics_v2,
)
from app.v5.api.main.dashboard.shared import (
    ParsedFilters,
    build_field_meta,
    build_parameter_meta,
    build_rubric_meta,
    build_scenario_meta,
    build_simulation_meta,
    fetch_chats_data,
    fetch_rubric_scores_data,
    fetch_thresholds,
    fetch_training_doc_ids,
    get_message_stats_internal,
    hydrate_rubric_resources,
)
from app.v5.api.main.dashboard.types import (
    DashboardBundleResponse,
    DashboardRequest,
    DashboardWebsocketEntries,
    DashboardWebsocketResources,
    GetDashboardApiRequest,
    GetDashboardWebsocketResponse,
)
from app.v5.api.main.types import (
    FilterOption,
    HistoryItem,
    HistoryResponse,
)
from app.v5.api.entries.attempt.get import ChatViewItem, get_attempt_chats_internal
from app.v5.api.entries.attempt.search import get_attempt_list_internal
from app.v5.api.entries.runs.search import GetRunListViewResponse
from app.v5.api.resources.documents.get import get_documents_internal
from app.v5.api.resources.fields.get import get_fields_internal
from app.v5.api.resources.parameter_fields.get import get_parameter_fields_internal
from app.v5.api.resources.parameters.get import get_parameters_internal
from app.v5.api.resources.personas.get import get_personas_internal
from app.v5.api.resources.profiles.get import get_profiles_internal
from app.v5.api.resources.scenarios.get import get_scenarios_internal
from app.v5.api.resources.simulations.get import get_simulations_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool

router = APIRouter()

# Dashboard resource types for agent resolution
DASHBOARD_BUNDLE_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "flags",
    "departments",
    "debug_info",
}

# =============================================================================
# History helpers — inline pipeline (entries layer → HistoryResponse)
# =============================================================================


def _compute_history_aggregates(
    chats: list[ChatViewItem],
) -> dict[str, Any]:
    """Compute attempt-level aggregates from chat view items."""
    num_chats = len(chats)
    num_chats_completed = sum(1 for c in chats if c.completed)

    scenario_ids_set: set[UUID] = set()
    completed_scenario_ids: set[UUID] = set()
    persona_ids_set: set[UUID] = set()

    total_score = 0.0
    total_possible = 0.0
    has_passed = False
    total_time_seconds = 0
    rubric_total_points: int | None = None
    rubric_pass_points: int | None = None

    for chat in chats:
        if chat.scenario_id:
            scenario_ids_set.add(chat.scenario_id)
            if chat.completed:
                completed_scenario_ids.add(chat.scenario_id)
        if chat.persona_ids:
            persona_ids_set.update(chat.persona_ids)

        if chat.grade:
            if chat.grade.score is not None and chat.grade.total_points:
                total_score += chat.grade.score
                total_possible += chat.grade.total_points
            if chat.grade.passed:
                has_passed = True
            if chat.grade.time_taken is not None:
                total_time_seconds += chat.grade.time_taken
            if chat.grade.total_points is not None:
                rubric_total_points = (
                    rubric_total_points or 0
                ) + chat.grade.total_points
            if chat.grade.pass_points is not None:
                rubric_pass_points = (rubric_pass_points or 0) + chat.grade.pass_points

    score_percent: float | None = None
    if total_possible > 0:
        score_percent = round((total_score / total_possible) * 100, 2)

    return {
        "num_scenarios": len(scenario_ids_set),
        "num_scenarios_completed": len(completed_scenario_ids),
        "num_chats": num_chats,
        "num_chats_completed": num_chats_completed,
        "score_percent": score_percent,
        "has_passed": has_passed,
        "total_time_seconds": total_time_seconds,
        "rubric_total_points": rubric_total_points,
        "rubric_pass_points": rubric_pass_points,
        "persona_ids": list(persona_ids_set) if persona_ids_set else None,
        "scenario_ids": list(scenario_ids_set) if scenario_ids_set else None,
    }


def _transform_history_item(
    attempt: Any,
    aggregates: dict[str, Any],
    resource_meta: dict[str, dict[UUID, dict[str, Any]]],
    pass_threshold: float | None,
    practice: bool,
) -> HistoryItem:
    """Transform an attempt MV row + aggregates into a HistoryItem."""
    sim_meta = (
        resource_meta["simulations"].get(attempt.simulation_id, {})
        if attempt.simulation_id
        else {}
    )
    simulation_name = sim_meta.get("name")
    time_limit = sim_meta.get("time_limit")

    profile_meta = (
        resource_meta["profiles"].get(attempt.profile_id, {})
        if attempt.profile_id
        else {}
    )
    profile_name = profile_meta.get("name")

    persona_names: list[str] = []
    persona_colors: list[str] = []
    persona_ids = aggregates.get("persona_ids")
    if persona_ids:
        for pid in persona_ids:
            p_meta = resource_meta["personas"].get(pid, {})
            if p_meta.get("name"):
                persona_names.append(p_meta["name"])
            if p_meta.get("color"):
                persona_colors.append(p_meta["color"])

    scenario_titles: list[str] = []
    scenario_ids = aggregates.get("scenario_ids") or (
        list(attempt.scenario_ids) if attempt.scenario_ids else None
    )
    if scenario_ids:
        for sid in scenario_ids:
            s_meta = resource_meta["scenarios"].get(sid, {})
            if s_meta.get("name"):
                scenario_titles.append(s_meta["name"])

    score_percent = aggregates.get("score_percent")
    pass_pct = compute_pass_pct(
        aggregates.get("rubric_total_points"), aggregates.get("rubric_pass_points")
    )
    score_status = compute_score_status(score_percent, pass_threshold)
    score = round(score_percent) if score_percent is not None else None

    is_archived = attempt.is_archived if practice else False
    show_view = compute_show_view(is_archived)
    num_incomplete_chats = (aggregates.get("num_chats") or 0) - (
        aggregates.get("num_chats_completed") or 0
    )
    show_continue = compute_show_continue(
        is_archived=is_archived,
        infinite_mode=attempt.infinite_mode,
        num_scenarios=aggregates.get("num_scenarios"),
        num_scenarios_completed=aggregates.get("num_scenarios_completed"),
        time_limit_seconds=time_limit,
        elapsed_seconds=aggregates.get("total_time_seconds"),
        num_incomplete_chats=num_incomplete_chats,
    )

    department_ids = [str(attempt.department_id)] if attempt.department_id else None
    practice_scenario_id = scenario_ids[0] if scenario_ids else None

    return HistoryItem(
        attempt_id=attempt.attempt_id,
        date=attempt.created_at.isoformat() if attempt.created_at else None,
        profile_id=attempt.profile_id,
        profile_name=profile_name,
        simulation_id=attempt.simulation_id,
        simulation_name=simulation_name,
        num_scenarios=aggregates.get("num_scenarios"),
        num_scenarios_completed=aggregates.get("num_scenarios_completed"),
        infinite_mode=attempt.infinite_mode,
        time_limit=time_limit,
        persona_names_junction=persona_names if persona_names else None,
        persona_colors_junction=persona_colors if persona_colors else None,
        scenario_ids=scenario_ids,
        scenario_titles=scenario_titles if scenario_titles else None,
        department_ids=department_ids,
        score=score,
        score_status=score_status,
        pass_pct=pass_pct,
        show_view=show_view,
        show_continue=show_continue,
        is_archived=is_archived if practice else None,
        practice_simulation=True if practice else None,
        practice_scenario_id=practice_scenario_id if practice else None,
    )


# =============================================================================
# Standalone history fetcher — reusable from header.py
# =============================================================================


async def fetch_dashboard_history_data(
    pool: asyncpg.Pool,
    *,
    profile_resource_id: UUID | None,
    target_profile_id: UUID | None,
    start_date: str | None,
    end_date: str | None,
    cohort_ids: list[UUID] | None,
    department_ids: list[UUID] | None,
    history_practice: bool = False,
    history_scenario_ids: list[UUID] | None = None,
    history_infinite_mode: bool | None = None,
    history_show_archived: bool = False,
    history_sort_by: str | None = "date",
    history_sort_order: str | None = "desc",
    history_page: int = 0,
    history_page_size: int = 20,
    history_simulation_search: str | None = None,
    history_scenario_search: str | None = None,
    history_profile_search: str | None = None,
    bypass_cache: bool = False,
) -> HistoryResponse | None:
    """Fetch attempt history data — shared between dashboard/get and dashboard/header."""
    if not profile_resource_id:
        return None

    query_profile_id = target_profile_id or profile_resource_id
    date_from = (
        datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        if start_date
        else None
    )
    date_to = (
        datetime.fromisoformat(end_date.replace("Z", "+00:00")) if end_date else None
    )
    practice = history_practice
    page = history_page
    page_size = history_page_size
    page_offset = page * page_size
    pass_threshold = 70.0

    # Step 1: Paginated attempts from attempt_mv
    async with pool.acquire() as c:
        list_result = await get_attempt_list_internal(
            conn=c,
            profile_id_filter=query_profile_id,
            practice_filter=practice,
            is_archived_filter=(history_show_archived if practice else False),
            simulation_id_filter=None,
            cohort_ids=cohort_ids,
            department_ids=department_ids,
            scenario_ids_filter=history_scenario_ids,
            infinite_mode_filter=history_infinite_mode,
            date_from=date_from,
            date_to=date_to,
            sort_by=history_sort_by or "date",
            sort_order=history_sort_order or "desc",
            page_limit=page_size,
            page_offset=page_offset,
            bypass_cache=bypass_cache,
        )

    # Step 2: Batch-fetch chats for paginated attempt_ids
    items = list_result.items or []
    paginated_ids = [item.attempt_id for item in items]

    chats: list[ChatViewItem] = []
    if paginated_ids:
        async with pool.acquire() as c:
            chats = await get_attempt_chats_internal(
                c, attempt_ids=paginated_ids, bypass_cache=bypass_cache
            )

    # Step 3: Group chats by attempt_id
    chats_by_attempt: dict[UUID, list[ChatViewItem]] = defaultdict(list)
    for chat in chats:
        if chat.attempt_id:
            chats_by_attempt[chat.attempt_id].append(chat)

    # Step 4: Compute aggregates and collect resource IDs
    h_sim_ids: set[UUID] = set()
    h_profile_ids: set[UUID] = set()
    h_persona_ids: set[UUID] = set()
    h_scenario_ids: set[UUID] = set()
    aggregates_by_attempt: dict[UUID, dict[str, Any]] = {}

    for item in items:
        attempt_chats = chats_by_attempt.get(item.attempt_id, [])
        agg = _compute_history_aggregates(attempt_chats)
        aggregates_by_attempt[item.attempt_id] = agg
        if item.simulation_id:
            h_sim_ids.add(item.simulation_id)
        if item.profile_id:
            h_profile_ids.add(item.profile_id)
        if agg.get("persona_ids"):
            h_persona_ids.update(agg["persona_ids"])
        if agg.get("scenario_ids"):
            h_scenario_ids.update(agg["scenario_ids"])
        elif item.scenario_ids:
            h_scenario_ids.update(item.scenario_ids)

    # Step 5: Fetch resource metadata in parallel
    async def _h_sims():
        if not h_sim_ids:
            return []
        async with pool.acquire() as c:
            return await get_simulations_internal(
                c, list(h_sim_ids), bypass_cache=bypass_cache
            )

    async def _h_profiles():
        if not h_profile_ids:
            return []
        async with pool.acquire() as c:
            return await get_profiles_internal(
                c, list(h_profile_ids), bypass_cache=bypass_cache
            )

    async def _h_personas():
        if not h_persona_ids:
            return []
        async with pool.acquire() as c:
            return await get_personas_internal(
                c, list(h_persona_ids), bypass_cache=bypass_cache
            )

    async def _h_scenarios():
        if not h_scenario_ids:
            return []
        async with pool.acquire() as c:
            return await get_scenarios_internal(
                c, list(h_scenario_ids), bypass_cache=bypass_cache
            )

    h_sims, h_profs, h_pers, h_scens = await asyncio.gather(
        _h_sims(), _h_profiles(), _h_personas(), _h_scenarios()
    )

    resource_meta: dict[str, dict[UUID, dict[str, Any]]] = {
        "simulations": {},
        "profiles": {},
        "personas": {},
        "scenarios": {},
    }
    for s in h_sims:
        if s.simulation_id:
            resource_meta["simulations"][s.simulation_id] = {
                "name": s.name,
                "time_limit": None,
            }
    for p in h_profs:
        if p.profile_id:
            resource_meta["profiles"][p.profile_id] = {"name": p.name}
    for p in h_pers:
        if p.persona_id:
            resource_meta["personas"][p.persona_id] = {
                "name": p.name,
                "color": p.color,
            }
    for s in h_scens:
        if s.scenario_id:
            resource_meta["scenarios"][s.scenario_id] = {"name": s.name}

    # Step 6: Transform attempts
    attempts = [
        _transform_history_item(
            item,
            aggregates_by_attempt.get(item.attempt_id, {}),
            resource_meta,
            pass_threshold,
            practice,
        )
        for item in items
    ]

    # Step 7: Build filter options with name resolution
    simulation_options: list[FilterOption] | None = None
    if list_result.simulation_options:
        simulation_options = []
        for opt in list_result.simulation_options:
            if not opt.value:
                continue
            try:
                sim_id = UUID(opt.value)
                label = (
                    resource_meta["simulations"].get(sim_id, {}).get("name")
                    or opt.value
                )
            except ValueError:
                label = opt.value
            simulation_options.append(
                FilterOption(value=opt.value, label=label, count=opt.count or 0)
            )
        if history_simulation_search:
            q = history_simulation_search.lower()
            simulation_options = [
                o for o in simulation_options if q in (o.label or "").lower()
            ]

    scenario_options: list[FilterOption] | None = None
    if list_result.scenario_options:
        scenario_options = []
        for opt in list_result.scenario_options:
            if not opt.value:
                continue
            try:
                scn_id = UUID(opt.value)
                label = (
                    resource_meta["scenarios"].get(scn_id, {}).get("name") or opt.value
                )
            except ValueError:
                label = opt.value
            scenario_options.append(
                FilterOption(value=opt.value, label=label, count=opt.count or 0)
            )
        if history_scenario_search:
            q = history_scenario_search.lower()
            scenario_options = [
                o for o in scenario_options if q in (o.label or "").lower()
            ]

    profile_options: list[FilterOption] | None = None
    if practice and list_result.profile_options:
        profile_options = []
        for opt in list_result.profile_options:
            if not opt.value:
                continue
            try:
                prof_id = UUID(opt.value)
                label = (
                    resource_meta["profiles"].get(prof_id, {}).get("name") or opt.value
                )
            except ValueError:
                label = opt.value
            profile_options.append(
                FilterOption(value=opt.value, label=label, count=opt.count or 0)
            )
        if history_profile_search:
            q = history_profile_search.lower()
            profile_options = [
                o for o in profile_options if q in (o.label or "").lower()
            ]

    total_count = list_result.total_count
    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0

    return HistoryResponse(
        data=attempts,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        simulation_options=simulation_options,
        scenario_options=scenario_options,
        profile_options=profile_options,
    )


# =============================================================================
# Internal Layer — unified single-pass data fetcher
# =============================================================================


async def get_dashboard_internal(
    pool: asyncpg.Pool,
    request: DashboardRequest,
    bypass_cache: bool = False,
    profile_resource_id: UUID | None = None,
) -> DashboardBundleResponse:
    """Single-pass efficient dashboard metrics bundle.

    Replaces the 4 independent section calls with:
    Phase 1 — Parallel data fetch (chats, rubric scores, thresholds, history)
    Phase 2 — Collect resource IDs
    Phase 3 — Parallel resource hydration
    Phase 4 — Enrich chat items (message stats, document_ids)
    Phase 5 — Compute all 4 sections' metrics
    Phase 6 — Assemble DashboardBundleResponse
    """
    # Build filters from the unified request
    parsed_start_date = (
        datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
        if request.start_date
        else None
    )
    parsed_end_date = (
        datetime.fromisoformat(request.end_date.replace("Z", "+00:00"))
        if request.end_date
        else None
    )
    is_archived = bool(
        request.simulation_filters and "archived" in request.simulation_filters
    )
    if request.simulation_filters and "general" in request.simulation_filters:
        attempt_type = "general"
    elif request.simulation_filters and "practice" in request.simulation_filters:
        attempt_type = "practice"
    else:
        attempt_type = None

    filters = ParsedFilters(
        simulation_ids=request.simulation_ids,
        cohort_ids=request.cohort_ids,
        parsed_start_date=parsed_start_date,
        parsed_end_date=parsed_end_date,
        is_archived=is_archived,
        attempt_type=attempt_type,
    )

    # Phase 1 — Parallel data fetch
    (
        chats_result,
        rubric_scores_result,
        thresholds,
        history_result,
    ) = await asyncio.gather(
        fetch_chats_data(
            pool=pool,
            request=request,
            filters=filters,
            bypass_cache=bypass_cache,
        ),
        fetch_rubric_scores_data(
            pool=pool,
            request=request,
            filters=filters,
            bypass_cache=bypass_cache,
        ),
        fetch_thresholds(
            pool=pool,
            actor_profile_id=request.actor_profile_id,
            target_profile_id=request.target_profile_id,
            department_ids=request.department_ids,
        ),
        fetch_dashboard_history_data(
            pool,
            profile_resource_id=profile_resource_id,
            target_profile_id=request.target_profile_id,
            start_date=request.start_date,
            end_date=request.end_date,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            history_practice=request.history_practice,
            history_scenario_ids=request.history_scenario_ids,
            history_infinite_mode=request.history_infinite_mode,
            history_show_archived=request.history_show_archived,
            history_sort_by=request.history_sort_by,
            history_sort_order=request.history_sort_order,
            history_page=request.history_page,
            history_page_size=request.history_page_size,
            history_simulation_search=request.history_simulation_search,
            history_scenario_search=request.history_scenario_search,
            history_profile_search=request.history_profile_search,
            bypass_cache=bypass_cache,
        ),
    )
    chat_items = chats_result.items
    rubric_items = rubric_scores_result.items

    # Phase 2 — Collect resource IDs from chats + rubric scores
    simulation_ids_set: set[UUID] = set()
    persona_ids_set: set[UUID] = set()
    cohort_ids_set: set[UUID] = set()
    scenario_ids_set: set[UUID] = set()
    attempt_chat_ids_set: set[UUID] = set()
    chat_ids: list[UUID] = []

    for item in chat_items:
        chat_ids.append(item.chat_id)
        if item.simulation_id:
            simulation_ids_set.add(item.simulation_id)
        if item.persona_ids:
            persona_ids_set.update(item.persona_ids)
        if item.cohort_id:
            cohort_ids_set.add(item.cohort_id)
        if item.scenario_id:
            scenario_ids_set.add(item.scenario_id)
        if item.attempt_chat_id:
            attempt_chat_ids_set.add(item.attempt_chat_id)

    rubric_ids_set: set[UUID] = set()
    for item in rubric_items:
        if item.rubric_id:
            rubric_ids_set.add(item.rubric_id)
        if item.simulation_id:
            simulation_ids_set.add(item.simulation_id)

    # Phase 3 — Parallel resource hydration
    async def _get_simulations() -> list[Any]:
        async with pool.acquire() as c:
            return await get_simulations_internal(
                conn=c, ids=list(simulation_ids_set), bypass_cache=bypass_cache
            )

    async def _get_personas() -> list[Any]:
        async with pool.acquire() as c:
            return await get_personas_internal(
                conn=c, ids=list(persona_ids_set), bypass_cache=bypass_cache
            )

    async def _get_scenarios() -> list[Any]:
        async with pool.acquire() as c:
            return await get_scenarios_internal(
                conn=c, ids=list(scenario_ids_set), bypass_cache=bypass_cache
            )

    async def _get_rubric_resources() -> tuple[list[Any], dict[str, str]]:
        return await hydrate_rubric_resources(
            pool=pool,
            rubric_ids=list(rubric_ids_set),
            bypass_cache=bypass_cache,
        )

    async def _get_message_stats() -> dict[UUID, Any]:
        if not chat_ids:
            return {}
        async with pool.acquire() as c:
            return await get_message_stats_internal(
                conn=c, chat_ids=chat_ids, bypass_cache=bypass_cache
            )

    async def _get_cohort_names() -> list[Any]:
        if not cohort_ids_set:
            return []
        async with pool.acquire() as c:
            return await c.fetch(
                """
                SELECT id, name FROM cohorts_resource
                WHERE id = ANY($1::uuid[])
                """,
                list(cohort_ids_set),
            )

    async def _get_scenario_counts() -> list[Any]:
        if not simulation_ids_set:
            return []
        async with pool.acquire() as c:
            return await c.fetch(
                """
                SELECT simulation_id, COUNT(*)::int AS scenario_count
                FROM simulation_scenarios_junction
                WHERE simulation_id = ANY($1::uuid[]) AND active = true
                GROUP BY simulation_id
                """,
                list(simulation_ids_set),
            )

    async def _get_training_doc_ids() -> dict[UUID, list[UUID]]:
        if not attempt_chat_ids_set:
            return {}
        async with pool.acquire() as c:
            return await fetch_training_doc_ids(
                conn=c,
                attempt_chat_ids=list(attempt_chat_ids_set),
                bypass_cache=bypass_cache,
            )

    async def _get_profiles() -> list[Any]:
        if not request.target_profile_id:
            return []
        async with pool.acquire() as c:
            return await get_profiles_internal(
                conn=c,
                ids=[UUID(str(request.target_profile_id))],
                bypass_cache=bypass_cache,
            )

    (
        simulations,
        personas,
        scenarios_list,
        (rubrics, standard_group_name_map),
        message_stats,
        cohort_name_rows,
        scenario_count_rows,
        doc_map,
        target_profiles,
    ) = await asyncio.gather(
        _get_simulations(),
        _get_personas(),
        _get_scenarios(),
        _get_rubric_resources(),
        _get_message_stats(),
        _get_cohort_names(),
        _get_scenario_counts(),
        _get_training_doc_ids(),
        _get_profiles(),
    )

    # Phase 4a — Enrich chat items with message stats
    for item in chat_items:
        stats = message_stats.get(item.chat_id)
        if stats:
            item.num_messages_total = stats.num_messages_total
            item.avg_response_sec = stats.avg_response_sec

    # Phase 4b — Enrich chat items with document_ids from training config
    for item in chat_items:
        if item.attempt_chat_id:
            doc_ids = doc_map.get(item.attempt_chat_id)
            if doc_ids:
                item.document_ids = list(doc_ids)

    # Phase 4c — Hydrate documents from collected document_ids
    document_ids_set: set[UUID] = set()
    for item in chat_items:
        for doc_id in item.document_ids or []:
            document_ids_set.add(doc_id)

    async with pool.acquire() as c:
        documents = await get_documents_internal(
            conn=c, ids=list(document_ids_set), bypass_cache=bypass_cache
        )

    # Phase 4d — Hydrate parameter_fields, then parameters + fields
    all_pf_ids: set[UUID] = set()
    for s in scenarios_list:
        for pfid in getattr(s, "parameter_field_ids", None) or []:
            all_pf_ids.add(pfid)
    for p in personas:
        for pfid in getattr(p, "parameter_field_ids", None) or []:
            all_pf_ids.add(pfid)
    for d in documents:
        for pfid in getattr(d, "parameter_field_ids", None) or []:
            all_pf_ids.add(pfid)

    async with pool.acquire() as c:
        parameter_fields = await get_parameter_fields_internal(
            conn=c, ids=list(all_pf_ids), bypass_cache=bypass_cache
        )

    parameter_ids_set: set[UUID] = set()
    field_ids_set: set[UUID] = set()
    field_parameter_map: dict[UUID, UUID] = {}
    for pf in parameter_fields:
        if pf.parameter_id:
            parameter_ids_set.add(pf.parameter_id)
        if pf.field_id:
            field_ids_set.add(pf.field_id)
            if pf.parameter_id:
                field_parameter_map[pf.field_id] = pf.parameter_id

    async def _get_parameters() -> list[Any]:
        async with pool.acquire() as c:
            return await get_parameters_internal(
                conn=c, ids=list(parameter_ids_set), bypass_cache=bypass_cache
            )

    async def _get_fields() -> list[Any]:
        async with pool.acquire() as c:
            return await get_fields_internal(
                conn=c, ids=list(field_ids_set), bypass_cache=bypass_cache
            )

    parameters, fields_list = await asyncio.gather(
        _get_parameters(),
        _get_fields(),
    )

    # Build name maps
    simulation_scenario_counts = {
        str(r["simulation_id"]): r["scenario_count"] for r in scenario_count_rows
    }
    persona_name_map: dict[str, str] = {
        str(p.persona_id): p.name for p in personas if p.persona_id and p.name
    }
    cohort_name_map: dict[str, str] = {
        str(r["id"]): r["name"] for r in cohort_name_rows if r["id"] and r["name"]
    }
    simulation_name_map: dict[str, str] = {
        str(s.simulation_id): s.name for s in simulations if s.simulation_id and s.name
    }
    scenario_name_map: dict[str, str] = {
        str(s.scenario_id): s.name for s in scenarios_list if s.scenario_id and s.name
    }

    thresholds_dict = thresholds.as_dict()

    # Phase 5 — Compute all 4 sections' metrics
    header_metrics = compute_header_metrics_v2(
        profile_facts_items=chat_items,
        simulation_scenario_counts=simulation_scenario_counts,
        thresholds=thresholds_dict,
    )

    primary_metrics = compute_primary_metrics_v2(
        rubric_facts=rubric_items,
        standard_group_name_map=standard_group_name_map,
        thresholds=thresholds_dict,
    )

    secondary_metrics = compute_secondary_metrics_v2(
        simulation_facts=chat_items,
        persona_name_map=persona_name_map,
        cohort_name_map=cohort_name_map,
        thresholds=thresholds_dict,
    )

    footer_metrics = compute_footer_metrics_v2(
        scenario_facts_items=chat_items,
        scenarios=scenarios_list,
        personas=personas,
        documents=documents,
        parameter_fields=parameter_fields,
        parameters=parameters,
        fields=fields_list,
        simulation_name_map=simulation_name_map,
        scenario_name_map=scenario_name_map,
        thresholds=thresholds_dict,
    )

    # Phase 5b — Apply picker filters (valid_*_ids stay intact for picker options)

    # Rubric section: filters heatmap matrices + skill packages
    if request.rubric_ids:
        filter_set = {str(rid) for rid in request.rubric_ids}
        primary_metrics.rubric_heatmap.matrices = [
            m
            for m in primary_metrics.rubric_heatmap.matrices
            if m.rubric_id in filter_set
        ]
        primary_metrics.skill_performance.packages = [
            p
            for p in primary_metrics.skill_performance.packages
            if p.rubric_id in filter_set
        ]

    # Simulation section: filters persona, cohort, and improvement charts
    if request.simulation_picker_ids:
        filter_set = {str(sid) for sid in request.simulation_picker_ids}
        secondary_metrics.persona_performance.chart_data = [
            row
            for row in secondary_metrics.persona_performance.chart_data
            if any(sid in filter_set for sid in (row.simulation_ids or []))
        ]
        secondary_metrics.cohort_performance.simulation_facts = [
            f
            for f in secondary_metrics.cohort_performance.simulation_facts
            if f.simulation_id in filter_set
        ]
        secondary_metrics.cohort_performance.daily_facts = [
            f
            for f in secondary_metrics.cohort_performance.daily_facts
            if f.simulation_id in filter_set
        ]
        secondary_metrics.attempt_improvement.facts = [
            f
            for f in secondary_metrics.attempt_improvement.facts
            if f.simulation_id in filter_set
        ]

    # Parameter section: filters scenario_performance + scenario_stats
    if request.parameter_ids:
        filter_set = {str(pid) for pid in request.parameter_ids}
        footer_metrics.scenario_performance.attribute_attempt_facts = [
            f
            for f in footer_metrics.scenario_performance.attribute_attempt_facts
            if f.parameter_id in filter_set
        ]
        footer_metrics.scenario_performance.attribute_scenario_facts = [
            f
            for f in footer_metrics.scenario_performance.attribute_scenario_facts
            if f.parameter_id in filter_set
        ]
        footer_metrics.scenario_stats.numeric_attempt_facts = [
            f
            for f in footer_metrics.scenario_stats.numeric_attempt_facts
            if f.parameter_id in filter_set
        ]
        footer_metrics.scenario_stats.numeric_scenario_facts = [
            f
            for f in footer_metrics.scenario_stats.numeric_scenario_facts
            if f.parameter_id in filter_set
        ]

    # Scenario section: filters scenario_simulation_performance + scenario_composition
    if request.scenario_ids:
        filter_set = {str(sid) for sid in request.scenario_ids}
        footer_metrics.scenario_simulation_performance.simulation_facts = [
            f
            for f in footer_metrics.scenario_simulation_performance.simulation_facts
            if f.scenario_id in filter_set
        ]
        footer_metrics.scenario_composition.scenario_summaries = [
            f
            for f in footer_metrics.scenario_composition.scenario_summaries
            if f.scenario_id in filter_set
        ]
        footer_metrics.scenario_composition.chat_parameter_facts = [
            f
            for f in footer_metrics.scenario_composition.chat_parameter_facts
            if f.scenario_id in filter_set
        ]

    # Phase 6 — Build metadata lists
    simulations_meta = build_simulation_meta(simulations)
    scenarios_meta = build_scenario_meta(scenarios_list)
    rubrics_meta = build_rubric_meta(rubrics)
    parameters_meta = build_parameter_meta(parameters)
    fields_meta = build_field_meta(fields_list, field_parameter_map, parameters)

    # Apply search filters to metadata lists
    if request.rubric_search:
        q = request.rubric_search.lower()
        rubrics_meta = [r for r in rubrics_meta if q in (r.get("name") or "").lower()]

    if request.simulation_picker_search:
        q = request.simulation_picker_search.lower()
        simulations_meta = [
            s for s in simulations_meta if q in (s.get("name") or "").lower()
        ]

    if request.parameter_search:
        q = request.parameter_search.lower()
        parameters_meta = [
            p for p in parameters_meta if q in (p.get("name") or "").lower()
        ]

    if request.scenario_search:
        q = request.scenario_search.lower()
        scenarios_meta = [
            s for s in scenarios_meta if q in (s.get("name") or "").lower()
        ]

    simulation_options = [
        FilterOption(
            value=str(item.simulation_id) if item.simulation_id else "",
            label=item.name,
        )
        for item in simulations
        if item.simulation_id
    ]

    bundle = DashboardBundleResponse(
        header_metrics=header_metrics,
        primary_metrics=primary_metrics,
        secondary_metrics=secondary_metrics,
        footer_metrics=footer_metrics,
        simulations=simulations_meta,
        scenarios=scenarios_meta,
        rubrics=rubrics_meta,
        parameters=parameters_meta,
        fields=fields_meta,
        thresholds=thresholds_dict,
        simulation_options=simulation_options,
    )

    # Attach profile metadata if target_profile_id is provided
    if target_profiles:
        tp = target_profiles[0]
        bundle.profile_name = tp.name
        bundle.profile_emails = tp.emails
        bundle.profile_primary_email = tp.primary_email

    # Attach history if fetched
    if history_result is not None:
        bundle.history = history_result

    return bundle


# =============================================================================
# WebSocket Layer
# =============================================================================


async def get_dashboard_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    dashboard_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetDashboardWebsocketResponse:
    """Fetch config resources for dashboard socket generation.

    Returns agent/model/provider chain + rate-limiting data (runs today, profile).
    This is separate from the metrics bundle — it's about LLM generation config.
    """
    from app.v5.api.auth.settings import get_auth_settings_internal
    from app.v5.api.entries.runs.search import get_run_list_entries_internal
    from app.v5.api.permissions import resolve_agents_for_artifact
    from app.v5.api.resources.models.get import get_models_internal
    from app.v5.api.resources.providers.get import get_providers_internal

    # 1. Fetch settings-based agent config
    async with pool.acquire() as conn:
        settings_data = await get_auth_settings_internal(conn, profile_id, bypass_cache)

    agent_ids, _create_tool_ids, _link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, DASHBOARD_BUNDLE_RESOURCES
    )

    config_agents = list(settings_data.settings_agents)
    config_tools = list(settings_data.settings_tools)

    # 2. Resolve model + provider chain from agents
    config_model_ids = list(
        dict.fromkeys(a.model_id for a in settings_data.settings_agents if a.model_id)
    )
    config_models: list[Any] = []
    if config_model_ids:
        async with pool.acquire() as conn:
            config_models = await get_models_internal(
                conn, config_model_ids, bypass_cache
            )

    config_provider_ids = list(
        dict.fromkeys(m.provider_id for m in config_models if m.provider_id)
    )
    config_providers: list[Any] = []
    if config_provider_ids:
        async with pool.acquire() as conn:
            config_providers = await get_providers_internal(
                conn, config_provider_ids, bypass_cache
            )

    # 3. Fetch config profile + runs today in parallel
    async def _fetch_config_profile() -> list[Any]:
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn, [profile_id], bypass_cache)

    async def _fetch_runs_today() -> GetRunListViewResponse:
        from datetime import UTC

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

    config_profile_result, runs_result = await asyncio.gather(
        _fetch_config_profile(),
        _fetch_runs_today(),
    )

    # 4. Resolve group_id
    group_id: UUID | None = None

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
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
            from app.v5.api.resources.args.get import get_args_internal
            from app.v5.api.resources.args_outputs.get import get_args_outputs_internal

            async def _fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_internal(
                        c, list(set(all_args_ids)), bypass_cache=bypass_cache
                    )

            async def _fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs_internal(
                        c, list(set(all_args_output_ids)), bypass_cache=bypass_cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                _fetch_args(),
                _fetch_args_outputs(),
            )

    return GetDashboardWebsocketResponse(
        entries=DashboardWebsocketEntries(
            runs=runs_result,
        ),
        resources=DashboardWebsocketResources(),
        agents=config_agents or None,
        models=config_models or None,
        providers=config_providers or None,
        tools=config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetDashboardApiRequest(dashboard_id=dashboard_id, draft_id=draft_id),
        resource_agent_ids=agent_ids,
        group_id=group_id,
    )


# =============================================================================
# Route Handler
# =============================================================================


@router.post("/get", response_model=DashboardBundleResponse)
async def get_dashboard(
    request: DashboardRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardBundleResponse:
    """Get full dashboard bundle with all 4 sections in a single call."""
    tags = ["artifacts", "dashboard", "views", "analytics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # Resolve profile_resource_id for history section
        profile_resource_id: UUID | None = None
        profile_id = http_request.state.profile_id
        if profile_id:
            profile_resource_id = await conn.fetchval(
                """
                SELECT profiles_id FROM profile_profiles_junction
                WHERE profile_id = $1 AND active = true
                LIMIT 1
                """,
                profile_id,
            )

        bundle = await get_dashboard_internal(
            pool=pool,
            request=request,
            bypass_cache=bypass_cache,
            profile_resource_id=profile_resource_id,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return bundle

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_dashboard_get",
            request=http_request,
        )
