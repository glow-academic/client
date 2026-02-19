"""Home get endpoint — dashboard-style parallel view fetches.

Hardcoded home mode (practice=False). Includes instructional mode logic
for elevated roles (instructional/admin/superadmin).
"""

import asyncio
from collections import defaultdict
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.home.types import GetHomeResponse
from app.api.v4.artifacts.training.permissions import (
    compute_completion_pct,
    compute_mode,
    compute_pass_pct,
    compute_status,
    compute_status_instructional,
    format_cohort_names,
)
from app.api.v4.artifacts.training.types import (
    RubricMapping,
    StandardGroupMapping,
    StandardMapping,
    TrainingSimulationOperational,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.entries.chat.get import ChatItem, GetChatsResponse, get_chats_internal
from app.api.v4.entries.home.get import get_home_context_view_internal
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.personas.get import get_personas_internal
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
from app.sql.types import GetHomeContextViewSqlRow
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


# =============================================================================
# Helpers
# =============================================================================


async def _fetch_cohort_member_profiles(
    pool: asyncpg.Pool,
    cohort_ids: list[UUID],
) -> dict[UUID, set[UUID]]:
    """Returns {cohort_id: set(profile_ids)} for member counting."""
    if not cohort_ids:
        return {}
    async with pool.acquire() as c:
        rows = await c.fetch(
            "SELECT id, cohort_ids FROM profiles_resource"
            " WHERE active = true AND cohort_ids && $1::uuid[]",
            cohort_ids,
        )
    result: dict[UUID, set[UUID]] = {cid: set() for cid in cohort_ids}
    for row in rows:
        for cid in row["cohort_ids"]:
            if cid in result:
                result[cid].add(row["id"])
    return result


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


def _aggregate_instructional_stats(
    facts_items: list[ChatItem],
    cohort_member_profiles: dict[UUID, set[UUID]],
    simulation_cohort_map: dict[UUID, list[UUID]],
) -> dict[UUID, dict[str, Any]]:
    """Per-simulation instructional stats: passed/in_progress/not_started counts."""
    best: dict[tuple[UUID, UUID], dict[str, Any]] = {}
    for item in facts_items:
        if not item.simulation_id or not item.profile_id:
            continue
        key = (item.simulation_id, item.profile_id)
        if key not in best:
            best[key] = {"has_passed": False, "has_attempted": True}
        if item.passed:
            best[key]["has_passed"] = True

    result: dict[UUID, dict[str, Any]] = {}
    for sim_id, cohort_ids in simulation_cohort_map.items():
        all_members: set[UUID] = set()
        for cid in cohort_ids:
            all_members |= cohort_member_profiles.get(cid, set())
        total_members = len(all_members)

        passed_count = 0
        in_progress_count = 0
        for pid in all_members:
            attempt = best.get((sim_id, pid))
            if attempt:
                if attempt["has_passed"]:
                    passed_count += 1
                else:
                    in_progress_count += 1

        not_started_count = total_members - passed_count - in_progress_count
        completion_pct = compute_completion_pct(
            passed_count, in_progress_count, total_members
        )
        status = compute_status_instructional(
            passed_count, in_progress_count, total_members
        )

        result[sim_id] = {
            "passed_count": passed_count,
            "in_progress_count": in_progress_count,
            "not_started_count": not_started_count,
            "completion_pct": completion_pct,
            "status": status,
            "total_members": total_members,
        }
    return result


# =============================================================================
# Main internal fetch
# =============================================================================


async def get_home_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> GetHomeResponse:
    """Dashboard-style parallel fetch for home operational data."""
    attempt_type = "general"

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
    async def fetch_context() -> GetHomeContextViewSqlRow:
        async with pool.acquire() as c:
            return await get_home_context_view_internal(
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

    context, personal_facts, profile_ctx = await asyncio.gather(
        fetch_context(), fetch_personal_stats(), fetch_profile_context()
    )

    actor_name = profile_ctx.access.actor_name if profile_ctx else None
    user_role = profile_ctx.access.role if profile_ctx else None
    view_mode = compute_mode(False, user_role)
    is_instructional = view_mode == "instructional"

    # Collect IDs for batch resource fetching
    simulation_ids: list[UUID] = []
    all_scenario_ids: set[UUID] = set()
    all_cohort_ids: set[UUID] = set()
    all_rubric_ids: set[UUID] = set()
    all_time_limit_ids: set[UUID] = set()
    simulation_cohort_map: dict[UUID, list[UUID]] = {}

    if context and context.items:
        for item in context.items:
            if item.simulation_id:
                simulation_ids.append(item.simulation_id)
            if item.scenario_ids:
                all_scenario_ids.update(item.scenario_ids)
            if item.cohort_ids:
                all_cohort_ids.update(item.cohort_ids)
                if item.simulation_id:
                    simulation_cohort_map[item.simulation_id] = list(item.cohort_ids)
            if item.rubric_ids:
                all_rubric_ids.update(item.rubric_ids)
            if item.time_limit_ids:
                all_time_limit_ids.update(item.time_limit_ids)

    cohort_ids_list = list(all_cohort_ids)
    rubric_ids_list = list(all_rubric_ids)
    scenario_ids_list = list(all_scenario_ids)
    time_limit_ids_list = list(all_time_limit_ids)

    # --- Phase 2a: Parallel resource hydration + conditional instructional data ---
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

    async def fetch_cohort_attempt_facts() -> list:
        async with pool.acquire() as c:
            result = await get_chats_internal(
                conn=c,
                profile_id=None,
                attempt_type=attempt_type,
                cohort_ids=cohort_ids_list,
                is_archived=False,
                page_limit=10000,
                page_offset=0,
                bypass_cache=bypass_cache,
            )
            return result.items

    async def fetch_cohort_members() -> dict[UUID, set[UUID]]:
        return await _fetch_cohort_member_profiles(pool, cohort_ids_list)

    tasks_2a: list[Any] = [
        fetch_simulations(),
        fetch_scenarios(),
        fetch_cohorts(),
        fetch_rubrics(),
        fetch_time_limits(),
    ]
    if is_instructional:
        tasks_2a.append(fetch_cohort_attempt_facts())
        tasks_2a.append(fetch_cohort_members())

    results_2a = await asyncio.gather(*tasks_2a)

    sim_list = results_2a[0]
    scenario_list = results_2a[1]
    cohort_list = results_2a[2]
    rubric_list = results_2a[3]
    time_limit_list = results_2a[4]

    cohort_facts_items: list[ChatItem] | None = None
    cohort_member_profiles: dict[UUID, set[UUID]] | None = None
    if is_instructional:
        cohort_facts_items = results_2a[5]
        cohort_member_profiles = results_2a[6]

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

    instructional_stats: dict[UUID, dict[str, Any]] | None = None
    if (
        is_instructional
        and cohort_facts_items is not None
        and cohort_member_profiles is not None
    ):
        instructional_stats = _aggregate_instructional_stats(
            cohort_facts_items, cohort_member_profiles, simulation_cohort_map
        )

    # --- Phase 3: Stitch + business logic ---
    items: list[TrainingSimulationOperational] = []
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

            training_entry_id = (
                item.training_entry_ids[0] if item.training_entry_ids else None
            )

            attempt_count = ps.get("attempt_count", 0)
            if is_instructional and instructional_stats is not None:
                ist = instructional_stats.get(item.simulation_id, {})
                status = ist.get("status", "not-started")
                completion_pct = ist.get("completion_pct", 0)
                passed_count = ist.get("passed_count", 0)
                in_progress_count = ist.get("in_progress_count", 0)
                not_started_count = ist.get("not_started_count", 0)
            else:
                status = compute_status(has_passed, attempt_count)
                completion_pct = None
                passed_count = None
                in_progress_count = None
                not_started_count = None

            items.append(
                TrainingSimulationOperational(
                    simulation_id=item.simulation_id,
                    simulation_name=simulation.name if simulation else None,
                    simulation_description=(
                        simulation.description if simulation else None
                    ),
                    time_limit=time_limit_minutes,
                    training_entry_id=training_entry_id,
                    scenario_ids=item.scenario_ids,
                    cohort_ids=item.cohort_ids,
                    color=color,
                    icon=icon,
                    view_mode=view_mode,
                    num_sessions=num_scenarios,
                    highest_score=highest_score,
                    has_passed=has_passed,
                    status=status,
                    pass_pct=pass_pct,
                    cohort_names_junction=cohort_names_junction,
                    standard_groups=standard_groups_strs,
                    practice_simulation=None,
                    completion_pct=completion_pct,
                    passed_count=passed_count,
                    in_progress_count=in_progress_count,
                    not_started_count=not_started_count,
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

    return GetHomeResponse(
        actor_name=actor_name,
        items=items,
        rubrics=rubrics,
        standard_groups=standard_groups,
        standards=standards,
    )


# =============================================================================
# Route handler
# =============================================================================


@router.post(
    "/get",
    response_model=GetHomeResponse,
    dependencies=[
        audit_activity("home.get", "{{ actor.name }} fetched home simulations")
    ],
)
async def home_get(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeResponse:
    """Get simulations available for home (operational)."""
    tags = ["home", "get"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    cache_key_val = cache_key(http_request.url.path, {})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetHomeResponse.model_validate(cached["data"])

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

        api_response = await get_home_internal(
            pool=pool,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

        if api_response.actor_name:
            audit_set(
                http_request,
                actor={"name": api_response.actor_name, "id": profile_id},
            )

        profile_specific_tags = tags + [f"home:profile:{profile_id}"]
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
            operation="home_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
