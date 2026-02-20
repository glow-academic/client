"""Attempt list endpoint for unified attempt history data."""

from collections import defaultdict
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.attempt.types import (
    AttemptListFilterOption,
    AttemptListItem,
    GetAttemptListRequest,
    GetAttemptListResponse,
)
from app.api.v4.artifacts.chat.permissions import (
    compute_pass_pct,
    compute_score_status,
    compute_show_continue,
    compute_show_view,
)
from app.api.v4.entries.attempt.get import ChatViewItem, get_attempt_chats_internal
from app.api.v4.entries.attempt.search import get_attempt_list_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import QGetAttemptListViewV4Item as AttemptViewItem
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

# Default pass threshold (was hardcoded as 70.0 in the deleted context SQL functions)
DEFAULT_PASS_THRESHOLD = 70.0

router = APIRouter()


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _compute_chat_aggregates(
    chats: list[ChatViewItem],
) -> dict[str, Any]:
    """Compute attempt-level aggregates from chat view items.

    Args:
        chats: List of ChatViewItem for a single attempt

    Returns:
        Dict with: num_scenarios, num_scenarios_completed, num_chats,
                   num_chats_completed, score_percent, has_passed,
                   total_time_seconds, rubric_total_points, rubric_pass_points,
                   persona_ids, scenario_ids
    """
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


def _transform_attempt(
    attempt: AttemptViewItem,
    aggregates: dict[str, Any],
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

    return AttemptListItem(
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
        items = await get_simulations_internal(
            conn, simulation_ids, bypass_cache=bypass_cache
        )
        for item in items:
            if item.simulation_id:
                result["simulations"][item.simulation_id] = {
                    "name": item.name,
                    "description": item.description,
                    "time_limit": None,  # TODO: time_limit not on simulations_resource
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


async def get_attempt_list_artifact_internal(
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

    # Step 1: Paginated attempts from attempt_mv (single query)
    list_result = await get_attempt_list_internal(
        conn=conn,
        profile_id_filter=profile_resource_id,
        practice_filter=practice,
        is_archived_filter=request.show_archived if practice else False,
        simulation_id_filter=None,
        cohort_ids=request.cohort_ids,
        department_ids=request.department_ids,
        scenario_ids_filter=request.scenario_ids,
        infinite_mode_filter=request.infinite_mode,
        date_from=date_from,
        date_to=date_to,
        sort_by=request.sort_by or "date",
        sort_order=request.sort_order or "desc",
        page_limit=page_size,
        page_offset=page_offset,
        bypass_cache=bypass_cache,
    )

    # Step 2: Batch-fetch chats for paginated attempt_ids (single query)
    items = list_result.items or []
    paginated_ids = [item.attempt_id for item in items]

    chats: list[ChatViewItem] = []
    if paginated_ids:
        chats = await get_attempt_chats_internal(
            conn, attempt_ids=paginated_ids, bypass_cache=bypass_cache
        )

    # Step 3: Group chats by attempt_id
    chats_by_attempt: dict[UUID, list[ChatViewItem]] = defaultdict(list)
    for chat in chats:
        if chat.attempt_id:
            chats_by_attempt[chat.attempt_id].append(chat)

    # Step 4: Compute aggregates per attempt and collect resource IDs
    all_simulation_ids: set[UUID] = set()
    all_profile_ids: set[UUID] = set()
    all_persona_ids: set[UUID] = set()
    all_scenario_ids: set[UUID] = set()

    aggregates_by_attempt: dict[UUID, dict[str, Any]] = {}
    for item in items:
        attempt_chats = chats_by_attempt.get(item.attempt_id, [])
        agg = _compute_chat_aggregates(attempt_chats)
        aggregates_by_attempt[item.attempt_id] = agg

        if item.simulation_id:
            all_simulation_ids.add(item.simulation_id)
        if item.profile_id:
            all_profile_ids.add(item.profile_id)
        if agg.get("persona_ids"):
            all_persona_ids.update(agg["persona_ids"])
        # Collect scenario IDs from both MV and aggregates
        if agg.get("scenario_ids"):
            all_scenario_ids.update(agg["scenario_ids"])
        elif item.scenario_ids:
            all_scenario_ids.update(item.scenario_ids)

    # Step 5: Fetch resource metadata
    resource_meta = await _fetch_resource_metadata(
        conn=conn,
        simulation_ids=list(all_simulation_ids),
        profile_ids=list(all_profile_ids),
        persona_ids=list(all_persona_ids),
        scenario_ids=list(all_scenario_ids),
        bypass_cache=bypass_cache,
    )

    # Step 6: Transform each attempt with aggregates
    attempts = [
        _transform_attempt(
            item,
            aggregates_by_attempt.get(item.attempt_id, {}),
            resource_meta,
            pass_threshold,
            practice,
        )
        for item in items
    ]

    # Step 7: Build filter options from view result
    simulation_options: list[AttemptListFilterOption] | None = None
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
                AttemptListFilterOption(
                    value=opt.value, label=label, count=opt.count or 0
                )
            )
        if request.simulation_search:
            q = request.simulation_search.lower()
            simulation_options = [
                o for o in simulation_options if q in (o.label or "").lower()
            ]

    scenario_options: list[AttemptListFilterOption] | None = None
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
                AttemptListFilterOption(
                    value=opt.value, label=label, count=opt.count or 0
                )
            )
        if request.scenario_search:
            q = request.scenario_search.lower()
            scenario_options = [
                o for o in scenario_options if q in (o.label or "").lower()
            ]

    profile_options: list[AttemptListFilterOption] | None = None
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
                AttemptListFilterOption(
                    value=opt.value, label=label, count=opt.count or 0
                )
            )
        if request.profile_search:
            q = request.profile_search.lower()
            profile_options = [
                o for o in profile_options if q in (o.label or "").lower()
            ]

    total_count = list_result.total_count
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

        # Fetch actor name from profile (replaces deleted context SQL functions)
        actor_name = await conn.fetchval(
            "SELECT COALESCE(name, '') FROM profiles_resource WHERE id = $1",
            profile_resource_id,
        )

        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        result = await get_attempt_list_artifact_internal(
            conn=conn,
            request=request,
            profile_resource_id=query_profile_id,
            pass_threshold=DEFAULT_PASS_THRESHOLD,
            actor_name=actor_name,
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
