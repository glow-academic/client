"""Attempt list endpoint for unified attempt history data."""

import asyncio
from datetime import datetime
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.attempt.types import (
    AttemptListFilterOption,
    AttemptListItem,
    GetAttemptListRequest,
    GetAttemptListResponse,
)
from app.api.v4.artifacts.filter_helpers import (
    fetch_cohort_filter_options,
    fetch_date_range_from_mv,
    fetch_department_filter_options,
)
from app.api.v4.artifacts.training.permissions import (
    compute_pass_pct,
    compute_score_status,
    compute_show_continue,
    compute_show_view,
)
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.types import get_simulations_batch_internal
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.api.v4.views.analytics.attempts.types import AttemptFactsItem
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetHomeContextSqlParams,
    GetHomeContextSqlRow,
    GetPracticeContextSqlParams,
    GetPracticeContextSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

HOME_CONTEXT_SQL_PATH = (
    "app/sql/v4/queries/analytics/home/get_home_context_complete.sql"
)
PRACTICE_CONTEXT_SQL_PATH = (
    "app/sql/v4/queries/analytics/practice/get_practice_context_complete.sql"
)

router = APIRouter()


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _transform_attempt(
    attempt: AttemptFactsItem,
    resource_meta: dict[str, dict[UUID, dict[str, Any]]],
    pass_threshold: float | None,
    practice: bool,
) -> AttemptListItem:
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
    if attempt.persona_ids:
        for pid in attempt.persona_ids:
            p_meta = resource_meta["personas"].get(pid, {})
            if p_meta.get("name"):
                persona_names.append(p_meta["name"])
            if p_meta.get("color"):
                persona_colors.append(p_meta["color"])

    scenario_titles: list[str] = []
    if attempt.scenario_ids:
        for sid in attempt.scenario_ids:
            s_meta = resource_meta["scenarios"].get(sid, {})
            if s_meta.get("name"):
                scenario_titles.append(s_meta["name"])

    pass_pct = compute_pass_pct(attempt.rubric_total_points, attempt.rubric_pass_points)
    score_status = compute_score_status(attempt.score_percent, pass_threshold)
    score = round(attempt.score_percent) if attempt.score_percent is not None else None

    is_archived = attempt.is_archived if practice else False
    show_view = compute_show_view(is_archived)
    num_incomplete_chats = (attempt.num_chats or 0) - (attempt.num_chats_completed or 0)
    show_continue = compute_show_continue(
        is_archived=is_archived,
        infinite_mode=attempt.infinite_mode,
        num_scenarios=attempt.num_scenarios,
        num_scenarios_completed=attempt.num_scenarios_completed,
        time_limit_seconds=time_limit,
        elapsed_seconds=attempt.total_time_seconds,
        num_incomplete_chats=num_incomplete_chats,
    )

    department_ids = [str(attempt.department_id)] if attempt.department_id else None
    practice_scenario_id = attempt.scenario_ids[0] if attempt.scenario_ids else None

    return AttemptListItem(
        attempt_id=attempt.attempt_id,
        date=attempt.attempt_created_at.isoformat()
        if attempt.attempt_created_at
        else None,
        profile_id=attempt.profile_id,
        profile_name=profile_name,
        simulation_id=attempt.simulation_id,
        simulation_name=simulation_name,
        num_scenarios=attempt.num_scenarios,
        num_scenarios_completed=attempt.num_scenarios_completed,
        infinite_mode=attempt.infinite_mode,
        time_limit=time_limit,
        persona_names_junction=persona_names if persona_names else None,
        persona_colors_junction=persona_colors if persona_colors else None,
        scenario_ids=attempt.scenario_ids,
        scenario_titles=scenario_titles if scenario_titles else None,
        department_ids=department_ids,
        cohort_names_junction=None,
        score=score,
        score_status=score_status,
        pass_pct=pass_pct,
        show_view=show_view,
        show_continue=show_continue,
        is_archived=is_archived if practice else None,
        practice_simulation=True if practice else None,
        practice_scenario_id=practice_scenario_id if practice else None,
    )


async def _fetch_resource_metadata(
    conn: asyncpg.Connection,
    simulation_ids: list[UUID],
    profile_ids: list[UUID],
    persona_ids: list[UUID],
    scenario_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[str, dict[UUID, dict[str, Any]]]:
    result: dict[str, dict[UUID, dict[str, Any]]] = {
        "simulations": {},
        "profiles": {},
        "personas": {},
        "scenarios": {},
    }

    if simulation_ids:
        items = await get_simulations_batch_internal(
            conn, simulation_ids, bypass_cache=bypass_cache
        )
        for item in items:
            if item.simulation_id:
                result["simulations"][item.simulation_id] = {
                    "name": item.title,
                    "description": item.description,
                    "time_limit": item.time_limit,
                }

    if profile_ids:
        items = await get_profiles_internal(
            conn, profile_ids, bypass_cache=bypass_cache
        )
        for item in items:
            if item.profile_id:
                result["profiles"][item.profile_id] = {
                    "name": item.name,
                }

    if persona_ids:
        items = await get_personas_internal(
            conn, persona_ids, bypass_cache=bypass_cache
        )
        for item in items:
            if item.persona_id:
                result["personas"][item.persona_id] = {
                    "name": item.name,
                    "icon": item.icon,
                    "color": item.color,
                }

    if scenario_ids:
        items = await get_scenarios_internal(
            conn, scenario_ids, bypass_cache=bypass_cache
        )
        for item in items:
            if item.scenario_id:
                result["scenarios"][item.scenario_id] = {
                    "name": item.name,
                    "description": item.description,
                }

    return result


async def get_attempt_list_internal(
    conn: asyncpg.Connection,
    request: GetAttemptListRequest,
    profile_resource_id: UUID,
    pass_threshold: float | None,
    actor_name: str | None = None,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v4/artifacts/attempt/list",
) -> GetAttemptListResponse:
    body = request.model_dump(mode="json")
    body["profile_resource_id"] = str(profile_resource_id)
    cache_key_val = cache_key(cache_key_path, body)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetAttemptListResponse.model_validate(cached["data"])

    date_from = _parse_iso_datetime(request.start_date)
    date_to = _parse_iso_datetime(request.end_date)
    page = request.page
    page_size = request.page_size
    page_offset = page * page_size
    practice = request.practice
    attempt_type = "practice" if practice else "general"

    facts_result = await get_attempt_facts_internal(
        conn=conn,
        profile_id=profile_resource_id,
        attempt_type=attempt_type,
        is_archived=request.show_archived if practice else False,
        simulation_ids=request.simulation_ids,
        cohort_ids=request.cohort_ids,
        department_ids=request.department_ids,
        scenario_ids=request.scenario_ids,
        infinite_mode=request.infinite_mode,
        date_from=date_from,
        date_to=date_to,
        search=request.search,
        sort_by=request.sort_by or "date",
        sort_order=request.sort_order or "desc",
        page_limit=page_size,
        page_offset=page_offset,
        bypass_cache=bypass_cache,
    )

    all_simulation_ids: set[UUID] = set()
    all_profile_ids: set[UUID] = set()
    all_persona_ids: set[UUID] = set()
    all_scenario_ids: set[UUID] = set()

    for item in facts_result.items:
        if item.simulation_id:
            all_simulation_ids.add(item.simulation_id)
        if item.profile_id:
            all_profile_ids.add(item.profile_id)
        if item.persona_ids:
            all_persona_ids.update(item.persona_ids)
        if item.scenario_ids:
            all_scenario_ids.update(item.scenario_ids)

    resource_meta = await _fetch_resource_metadata(
        conn=conn,
        simulation_ids=list(all_simulation_ids),
        profile_ids=list(all_profile_ids),
        persona_ids=list(all_persona_ids),
        scenario_ids=list(all_scenario_ids),
        bypass_cache=bypass_cache,
    )

    attempts = [
        _transform_attempt(item, resource_meta, pass_threshold, practice)
        for item in facts_result.items
    ]

    simulation_options: list[AttemptListFilterOption] | None = None
    if facts_result.simulation_options:
        simulation_options = []
        for opt in facts_result.simulation_options:
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
                AttemptListFilterOption(
                    value=opt.value, label=label, count=opt.count or 0
                )
            )

    scenario_options: list[AttemptListFilterOption] | None = None
    if facts_result.scenario_options:
        scenario_options = []
        for opt in facts_result.scenario_options:
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
                AttemptListFilterOption(
                    value=opt.value, label=label, count=opt.count or 0
                )
            )

    profile_options: list[AttemptListFilterOption] | None = None
    if practice and facts_result.profile_options:
        profile_options = []
        for opt in facts_result.profile_options:
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
                AttemptListFilterOption(
                    value=opt.value, label=label, count=opt.count or 0
                )
            )

    total_count = facts_result.total_count
    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0

    api_response = GetAttemptListResponse(
        actor_name=actor_name,
        data=attempts,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        simulation_options=simulation_options,
        scenario_options=scenario_options,
        profile_options=profile_options,
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=["artifacts", "attempt", f"attempt:list:profile:{profile_resource_id}"],
    )
    return api_response


@router.post(
    "/list",
    response_model=GetAttemptListResponse,
    dependencies=[
        audit_activity(
            "artifacts.attempt.list", "{{ actor.name }} fetched attempt list"
        )
    ],
)
async def list_attempts(
    request: GetAttemptListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptListResponse:
    """Get unified attempt history list for home/practice style screens."""
    tags = ["artifacts", "attempt", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        profile_resource_id = await conn.fetchval(
            """
            SELECT profiles_id FROM profile_profiles_junction
            WHERE profile_id = $1 AND active = true
            LIMIT 1
            """,
            profile_id,
        )
        if not profile_resource_id:
            raise HTTPException(
                status_code=401,
                detail="Profile not found. Please sign in again.",
            )

        # Use target_profile_id when viewing another user's report
        query_profile_id = request.target_profile_id or profile_resource_id

        if request.practice:
            context = cast(
                GetPracticeContextSqlRow,
                await execute_sql_typed(
                    conn,
                    PRACTICE_CONTEXT_SQL_PATH,
                    params=GetPracticeContextSqlParams(profile_id=profile_resource_id),
                ),
            )
        else:
            context = cast(
                GetHomeContextSqlRow,
                await execute_sql_typed(
                    conn,
                    HOME_CONTEXT_SQL_PATH,
                    params=GetHomeContextSqlParams(profile_id=profile_resource_id),
                ),
            )

        if context.actor_name:
            audit_set(
                http_request, actor={"name": context.actor_name, "id": profile_id}
            )

        pool = get_pool()
        has_accessible_ids = bool(
            request.accessible_cohort_ids or request.accessible_department_ids
        )

        if has_accessible_ids and pool:
            result, cohort_opts, dept_opts, date_range = await asyncio.gather(
                get_attempt_list_internal(
                    conn=conn,
                    request=request,
                    profile_resource_id=query_profile_id,
                    pass_threshold=context.pass_threshold,
                    actor_name=context.actor_name,
                    bypass_cache=bypass_cache,
                    cache_key_path=http_request.url.path,
                ),
                fetch_cohort_filter_options(pool, request.accessible_cohort_ids),
                fetch_department_filter_options(
                    pool, request.accessible_department_ids
                ),
                fetch_date_range_from_mv(pool, request.accessible_department_ids),
            )
            result.cohort_options = [
                AttemptListFilterOption(value=o.value, label=o.label, count=o.count)
                for o in cohort_opts
            ]
            result.department_options = [
                AttemptListFilterOption(value=o.value, label=o.label, count=o.count)
                for o in dept_opts
            ]
            result.date_range_earliest = date_range[0]
            result.date_range_latest = date_range[1]
        else:
            result = await get_attempt_list_internal(
                conn=conn,
                request=request,
                profile_resource_id=query_profile_id,
                pass_threshold=context.pass_threshold,
                actor_name=context.actor_name,
                bypass_cache=bypass_cache,
                cache_key_path=http_request.url.path,
            )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_attempt_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
