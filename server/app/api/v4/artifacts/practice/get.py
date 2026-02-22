"""Practice get endpoint — dashboard-style parallel view fetches.

Hardcoded practice mode (practice=True). No instructional mode logic —
practice is always personal/member mode.
"""

import asyncio
from collections import defaultdict
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.chat.get import get_chat_internal
from app.api.v4.artifacts.chat.permissions import (
    compute_pass_pct,
    compute_score_status,
    compute_show_continue,
    compute_show_view,
    compute_status,
    format_cohort_names,
)
from app.api.v4.artifacts.chat.types import (
    ChatSimulationOperational,
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
)
from app.api.v4.artifacts.practice.types import (
    GetPracticeRequest,
    GetPracticeResponse,
    GetPracticeWebsocketResponse,
    PracticeWebsocketEntries,
    PracticeWebsocketResources,
)
from app.api.v4.artifacts.types import (
    FilterOption,
    HistoryItem,
    HistoryResponse,
    WebsocketConfig,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.entries.attempt.get import ChatViewItem, get_attempt_chats_internal
from app.api.v4.entries.attempt.search import get_attempt_list_internal
from app.api.v4.entries.chat.get import ChatItem, GetChatsResponse, get_chats_internal
from app.api.v4.entries.practice.get import get_practice_context_view_internal
from app.api.v4.entries.runs.search import get_run_list_entries_internal
from app.api.v4.resources.args.get import get_args_internal
from app.api.v4.resources.args_outputs.get import get_args_outputs_internal
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.rubrics.get import get_rubrics_internal
from app.api.v4.resources.scenario_time_limits.get import (
    get_scenario_time_limits_internal,
)
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.api.v4.resources.standard_groups.get import get_standard_groups_internal
from app.api.v4.resources.standards.search import search_standards_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import GetPracticeContextViewSqlRow
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


# =============================================================================
# Helpers
# =============================================================================


def _aggregate_personal_stats(
    items: list[ChatItem],
) -> dict[UUID, dict[str, Any]]:
    """Aggregate personal profile facts by simulation_id."""
    stats: dict[UUID, dict[str, Any]] = {}
    seen_attempts: dict[UUID, set[UUID]] = defaultdict(set)
    for item in items:
        if not item.simulation_id:
            continue
        sim_id = item.simulation_id
        if sim_id not in stats:
            stats[sim_id] = {
                "attempt_count": 0,
                "highest_score_percent": None,
                "has_passed": False,
            }
        s = stats[sim_id]
        if item.attempt_id and item.attempt_id not in seen_attempts[sim_id]:
            seen_attempts[sim_id].add(item.attempt_id)
            s["attempt_count"] += 1
        if item.grade_percent is not None:
            score = float(item.grade_percent)
            if s["highest_score_percent"] is None or score > s["highest_score_percent"]:
                s["highest_score_percent"] = score
        if item.passed:
            s["has_passed"] = True
    return stats


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
        is_archived=is_archived,
        practice_simulation=True,
        practice_scenario_id=practice_scenario_id,
    )


async def _fetch_practice_history_data(
    pool: asyncpg.Pool,
    request: GetPracticeRequest,
    profile_resource_id: UUID,
    bypass_cache: bool = False,
) -> HistoryResponse | None:
    """Fetch paginated attempt history for practice page."""
    if not profile_resource_id:
        return None

    practice = True
    page = request.history_page
    page_size = request.history_page_size
    page_offset = page * page_size
    pass_threshold = 70.0

    # Step 1: Paginated attempts from attempt_mv
    async with pool.acquire() as c:
        list_result = await get_attempt_list_internal(
            conn=c,
            profile_id_filter=profile_resource_id,
            practice_filter=practice,
            is_archived_filter=request.history_show_archived,
            simulation_id_filter=None,
            cohort_ids=None,
            department_ids=None,
            scenario_ids_filter=request.history_scenario_ids,
            infinite_mode_filter=request.history_infinite_mode,
            date_from=None,
            date_to=None,
            sort_by=request.history_sort_by or "date",
            sort_order=request.history_sort_order or "desc",
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
    async def _h_sims() -> list[Any]:
        if not h_sim_ids:
            return []
        async with pool.acquire() as c:
            return await get_simulations_internal(
                c, list(h_sim_ids), bypass_cache=bypass_cache
            )

    async def _h_profiles() -> list[Any]:
        if not h_profile_ids:
            return []
        async with pool.acquire() as c:
            return await get_profiles_internal(
                c, list(h_profile_ids), bypass_cache=bypass_cache
            )

    async def _h_personas() -> list[Any]:
        if not h_persona_ids:
            return []
        async with pool.acquire() as c:
            return await get_personas_internal(
                c, list(h_persona_ids), bypass_cache=bypass_cache
            )

    async def _h_scenarios() -> list[Any]:
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
        if request.history_simulation_search:
            q = request.history_simulation_search.lower()
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
        if request.history_scenario_search:
            q = request.history_scenario_search.lower()
            scenario_options = [
                o for o in scenario_options if q in (o.label or "").lower()
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
    )


# =============================================================================
# Main internal fetch
# =============================================================================


async def get_practice_internal(
    pool: asyncpg.Pool,
    request: GetPracticeRequest,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> GetPracticeResponse:
    """Dashboard-style parallel fetch for practice operational data."""
    attempt_type = "practice"

    # --- Phase 0: Resolve profile_id → profiles_resource_id ---
    async with pool.acquire() as c:
        profiles_resource_id = await c.fetchval(
            """
            SELECT profiles_id FROM profile_profiles_junction
            WHERE profile_id = $1 AND active = true
            LIMIT 1
            """,
            profile_id,
        )

    # --- Phase 1: Three parallel fetches ---
    async def fetch_context() -> GetPracticeContextViewSqlRow:
        async with pool.acquire() as c:
            return await get_practice_context_view_internal(
                conn=c,
                profile_id=profile_id,
                bypass_cache=bypass_cache,
            )

    async def fetch_personal_stats() -> GetChatsResponse:
        async with pool.acquire() as c:
            return await get_chats_internal(
                conn=c,
                profile_id=profiles_resource_id,
                attempt_type=attempt_type,
                is_archived=False,
                page_limit=10000,
                page_offset=0,
                bypass_cache=bypass_cache,
            )

    async def fetch_profile_context():
        async with pool.acquire() as c:
            return await get_auth_profile_internal(
                conn=c,
                profile_id=profile_id,
                bypass_cache=bypass_cache,
            )

    async def fetch_history() -> HistoryResponse | None:
        return await _fetch_practice_history_data(
            pool=pool,
            request=request,
            profile_resource_id=profiles_resource_id,
            bypass_cache=bypass_cache,
        )

    context, personal_facts, profile_ctx, history_result = await asyncio.gather(
        fetch_context(),
        fetch_personal_stats(),
        fetch_profile_context(),
        fetch_history(),
    )

    actor_name = profile_ctx.access.actor_name if profile_ctx else None

    # Collect IDs for batch resource fetching
    simulation_ids: list[UUID] = []
    all_scenario_ids: set[UUID] = set()
    all_cohort_ids: set[UUID] = set()
    all_rubric_ids: set[UUID] = set()
    all_time_limit_ids: set[UUID] = set()

    if context and context.items:
        for item in context.items:
            if item.simulation_id:
                simulation_ids.append(item.simulation_id)
            if item.scenario_ids:
                all_scenario_ids.update(item.scenario_ids)
            if item.cohort_ids:
                all_cohort_ids.update(item.cohort_ids)
            if item.rubric_ids:
                all_rubric_ids.update(item.rubric_ids)
            if item.time_limit_ids:
                all_time_limit_ids.update(item.time_limit_ids)

    cohort_ids_list = list(all_cohort_ids)
    rubric_ids_list = list(all_rubric_ids)
    scenario_ids_list = list(all_scenario_ids)
    time_limit_ids_list = list(all_time_limit_ids)

    # --- Phase 2a: Parallel resource hydration (no instructional data) ---
    async def fetch_simulations() -> list:
        async with pool.acquire() as c:
            return await get_simulations_internal(
                c, simulation_ids, bypass_cache=bypass_cache
            )

    async def fetch_scenarios() -> list:
        if not scenario_ids_list:
            return []
        async with pool.acquire() as c:
            return await get_scenarios_internal(
                c, scenario_ids_list, bypass_cache=bypass_cache
            )

    async def fetch_cohorts() -> list:
        async with pool.acquire() as c:
            return await get_cohorts_internal(
                c, cohort_ids_list, bypass_cache=bypass_cache
            )

    async def fetch_rubrics() -> list:
        async with pool.acquire() as c:
            return await get_rubrics_internal(
                c, rubric_ids_list, bypass_cache=bypass_cache
            )

    async def fetch_time_limits() -> list:
        if not time_limit_ids_list:
            return []
        async with pool.acquire() as c:
            return await get_scenario_time_limits_internal(
                c, time_limit_ids_list, bypass_cache=bypass_cache
            )

    (
        sim_list,
        scenario_list,
        cohort_list,
        rubric_list,
        time_limit_list,
    ) = await asyncio.gather(
        fetch_simulations(),
        fetch_scenarios(),
        fetch_cohorts(),
        fetch_rubrics(),
        fetch_time_limits(),
    )

    # Build scenario_id → time_limit_seconds map from time limits resource
    scenario_time_limit_map: dict[UUID, int] = {}
    for tl in time_limit_list:
        if tl.scenario_id and tl.time_limit_seconds:
            scenario_time_limit_map[tl.scenario_id] = tl.time_limit_seconds

    # Derive persona IDs from scenarios (persona_ids on scenarios_resource)
    scenario_map = {s.scenario_id: s for s in scenario_list if s.scenario_id}
    all_persona_ids: set[UUID] = set()
    for s in scenario_list:
        if s.persona_ids:
            all_persona_ids.update(s.persona_ids)

    # Fetch personas sequentially (depends on scenario data)
    persona_list: list = []
    if all_persona_ids:
        async with pool.acquire() as c:
            persona_list = await get_personas_internal(
                c, list(all_persona_ids), bypass_cache=bypass_cache
            )

    # --- Phase 2b: Sequential — derive standard_group_ids from rubrics ---
    rubric_map = {r.id: r for r in rubric_list if r.id}

    all_standard_group_ids: set[UUID] = set()
    for r in rubric_list:
        if r.standard_group_ids:
            all_standard_group_ids.update(r.standard_group_ids)

    standard_group_ids_list = list(all_standard_group_ids)

    async def fetch_standard_groups() -> list:
        if not standard_group_ids_list:
            return []
        async with pool.acquire() as c:
            return await get_standard_groups_internal(
                c, standard_group_ids_list, bypass_cache=bypass_cache
            )

    async def fetch_standards() -> list:
        if not standard_group_ids_list:
            return []
        async with pool.acquire() as c:
            return await search_standards_internal(
                c,
                standard_group_ids=standard_group_ids_list,
                bypass_cache=bypass_cache,
            )

    sg_list, std_list = await asyncio.gather(fetch_standard_groups(), fetch_standards())

    # Build lookup maps
    simulation_map = {
        item.simulation_id: item for item in sim_list if item.simulation_id
    }
    persona_map = {item.persona_id: item for item in persona_list if item.persona_id}
    cohort_map = {item.cohort_id: item for item in cohort_list if item.cohort_id}
    standard_groups_map = {
        item.standard_group_id: item for item in sg_list if item.standard_group_id
    }

    # Aggregate stats
    personal_stats = _aggregate_personal_stats(personal_facts.items)

    # --- Phase 3: Stitch + business logic ---
    items: list[ChatSimulationOperational] = []
    if context and context.items:
        for item in context.items:
            simulation = simulation_map.get(item.simulation_id)
            ps = personal_stats.get(item.simulation_id, {})
            highest_score_percent = ps.get("highest_score_percent")
            has_passed = ps.get("has_passed", False)

            num_scenarios = len(item.scenario_ids) if item.scenario_ids else 0

            time_limit_total_seconds = 0
            has_time_limits = False
            if item.scenario_ids:
                for sid in item.scenario_ids:
                    tl_seconds = scenario_time_limit_map.get(sid)
                    if tl_seconds is not None:
                        time_limit_total_seconds += tl_seconds
                        has_time_limits = True
            time_limit_minutes = (
                round(time_limit_total_seconds / 60) if has_time_limits else None
            )

            color: str | None = None
            icon: str | None = None
            if item.scenario_ids:
                unique_colors: set[str | None] = set()
                first_persona = None
                for sid in item.scenario_ids:
                    scenario = scenario_map.get(sid)
                    if scenario and scenario.persona_ids:
                        persona = persona_map.get(scenario.persona_ids[0])
                        if persona:
                            unique_colors.add(persona.color)
                            if first_persona is None:
                                first_persona = persona
                if len(unique_colors) == 1 and first_persona:
                    color = first_persona.color
                    icon = first_persona.icon

            item_sg_ids: list[UUID] = []
            if item.rubric_ids:
                for rid in item.rubric_ids:
                    rubric = rubric_map.get(rid)
                    if rubric and rubric.standard_group_ids:
                        item_sg_ids.extend(rubric.standard_group_ids)

            rubric_total_points = 0
            rubric_pass_points = 0
            for sgid in item_sg_ids:
                sg = standard_groups_map.get(sgid)
                if sg:
                    rubric_total_points += sg.points or 0
                    rubric_pass_points += sg.pass_points or 0

            pass_pct = compute_pass_pct(
                rubric_total_points if rubric_total_points > 0 else None,
                rubric_pass_points if rubric_pass_points > 0 else None,
            )

            cohort_titles = (
                [
                    cohort_map[cid].title
                    for cid in item.cohort_ids
                    if cid in cohort_map and cohort_map[cid].title
                ]
                if item.cohort_ids
                else None
            )
            cohort_names_junction = format_cohort_names(cohort_titles)

            highest_score = (
                round(highest_score_percent)
                if highest_score_percent is not None
                else None
            )

            standard_groups_strs = (
                [str(sg_id) for sg_id in item_sg_ids] if item_sg_ids else None
            )

            chat_entry_id = item.chat_entry_ids[0] if item.chat_entry_ids else None

            attempt_count = ps.get("attempt_count", 0)
            status = compute_status(has_passed, attempt_count)

            items.append(
                ChatSimulationOperational(
                    simulation_id=item.simulation_id,
                    simulation_name=simulation.name if simulation else None,
                    simulation_description=(
                        simulation.description if simulation else None
                    ),
                    time_limit=time_limit_minutes,
                    chat_entry_id=chat_entry_id,
                    scenario_ids=item.scenario_ids,
                    cohort_ids=item.cohort_ids,
                    color=color,
                    icon=icon,
                    view_mode="practice",
                    num_sessions=num_scenarios,
                    highest_score=highest_score,
                    has_passed=has_passed,
                    status=status,
                    pass_pct=pass_pct,
                    cohort_names_junction=cohort_names_junction,
                    standard_groups=standard_groups_strs,
                    practice_simulation=True,
                    completion_pct=None,
                    passed_count=None,
                    in_progress_count=None,
                    not_started_count=None,
                )
            )

    # Build rubric mappings
    rubrics: list[RubricMapping] | None = None
    if rubric_list:
        rubrics = [
            RubricMapping(
                rubric_id=r.id,  # type: ignore[arg-type]
                name=r.name,
                standard_group_ids=(
                    [str(sg_id) for sg_id in r.standard_group_ids]
                    if r.standard_group_ids
                    else None
                ),
            )
            for r in rubric_list
            if r.id
        ]

    standard_groups: list[StandardGroupMapping] | None = None
    if standard_group_ids_list:
        standard_groups = [
            StandardGroupMapping(
                standard_group_id=sg.standard_group_id,  # type: ignore[arg-type]
                name=sg.name,
                description=sg.description,
                points=sg.points,
                pass_points=sg.pass_points,
            )
            for sgid in standard_group_ids_list
            for sg in [standard_groups_map.get(sgid)]
            if sg and sg.standard_group_id
        ]

    standards: list[StandardMapping] | None = None
    if std_list:
        standards = [
            StandardMapping(
                standard_id=st.standard_id,  # type: ignore[arg-type]
                standard_group_id=st.standard_group_id,
                name=st.name,
                description=st.description,
                points=st.points,
            )
            for st in std_list
            if st.standard_id
        ]

    return GetPracticeResponse(
        actor_name=actor_name,
        items=items,
        rubrics=rubrics,
        standard_groups=standard_groups,
        standards=standards,
        history=history_result,
    )


# =============================================================================
# Websocket wrapper
# =============================================================================


async def get_practice_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    chat_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetPracticeWebsocketResponse:
    """Independent websocket wrapper for practice generation — config chain + bundle resources."""

    async def fetch_bundle():
        return await get_chat_internal(
            pool=pool,
            profile_id=profile_id,
            chat_entry_id=chat_entry_id,
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

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_tools = data.config_tools or []
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
                    return await get_args_internal(
                        c, list(set(all_args_ids)), bypass_cache=bypass_cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs_internal(
                        c, list(set(all_args_output_ids)), bypass_cache=bypass_cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    websocket_config = WebsocketConfig(
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=data.config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
    )

    return GetPracticeWebsocketResponse(
        entries=PracticeWebsocketEntries(
            draft_training=data.draft_item,
            runs=runs_result,
        ),
        resources=PracticeWebsocketResources(
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
        ),
        config=websocket_config,
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


# =============================================================================
# Route handler
# =============================================================================


@router.post(
    "/get",
    response_model=GetPracticeResponse,
    dependencies=[
        audit_activity("practice.get", "{{ actor.name }} fetched practice simulations")
    ],
)
async def practice_get(
    request: GetPracticeRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPracticeResponse:
    """Get simulations available for practice (operational)."""
    tags = ["practice", "get"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    cache_key_val = cache_key(
        http_request.url.path,
        request.model_dump(mode="json"),
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetPracticeResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

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

        api_response = await get_practice_internal(
            pool=pool,
            request=request,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

        if api_response.actor_name:
            audit_set(
                http_request,
                actor={"name": api_response.actor_name, "id": profile_id},
            )

        profile_specific_tags = tags + [f"practice:profile:{profile_id}"]
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=profile_specific_tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="practice_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
