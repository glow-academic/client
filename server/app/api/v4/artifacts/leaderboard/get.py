"""Get endpoint for leaderboard artifact."""

import asyncio
from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.leaderboard.permissions import (
    build_leaderboard_rows_v2,
    build_leaderboard_sections_v2,
)
from app.api.v4.artifacts.leaderboard.types import (
    LeaderboardProfileResource,
    LeaderboardRequest,
    LeaderboardResources,
    LeaderboardResponse,
    LeaderboardScenarioResource,
    LeaderboardSections,
    LeaderboardSimulationResource,
    LeaderboardViews,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.entries.chat.get import get_chats_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import GetActiveSettingsSqlParams, GetActiveSettingsSqlRow
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

router = APIRouter()

# ---------------------------------------------------------------------------
# SQL paths
# ---------------------------------------------------------------------------

SQL_PATH_MESSAGE_STATS = (
    "app/sql/v4/queries/views/chat/message_stats/get_message_stats_complete.sql"
)

ACTIVE_SETTINGS_SQL_PATH = (
    "app/sql/v4/queries/settings/get_active_settings_complete.sql"
)


# ---------------------------------------------------------------------------
# Message stats types
# ---------------------------------------------------------------------------


class MessageStats:
    """Message statistics for a single chat."""

    __slots__ = ("chat_id", "num_messages_total", "avg_response_sec")

    def __init__(
        self,
        chat_id: UUID,
        num_messages_total: int = 0,
        avg_response_sec: float | None = None,
    ) -> None:
        self.chat_id = chat_id
        self.num_messages_total = num_messages_total
        self.avg_response_sec = avg_response_sec


# ---------------------------------------------------------------------------
# get_message_stats_internal
# ---------------------------------------------------------------------------


async def get_message_stats_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, MessageStats]:
    """Fetch message stats for a batch of chat IDs.

    Returns a dict keyed by chat_id for O(1) lookup.
    """
    if not chat_ids:
        return {}

    from app.sql.types import GetMessageStatsSqlParams

    cache_key_val = cache_key(
        "entries/chat/message_stats",
        {"chat_ids": sorted(str(c) for c in chat_ids)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return {
                UUID(k): MessageStats(
                    chat_id=UUID(k),
                    num_messages_total=v["num_messages_total"],
                    avg_response_sec=v.get("avg_response_sec"),
                )
                for k, v in cached.items()
            }

    params = GetMessageStatsSqlParams(chat_ids=chat_ids)
    result = await execute_sql_typed(conn, SQL_PATH_MESSAGE_STATS, params=params)

    stats_map: dict[UUID, MessageStats] = {}
    if result and result.items:
        for item in result.items:
            if item.chat_id:
                stats_map[item.chat_id] = MessageStats(
                    chat_id=item.chat_id,
                    num_messages_total=item.num_messages_total or 0,
                    avg_response_sec=float(item.avg_response_sec)
                    if item.avg_response_sec is not None
                    else None,
                )

    # Cache as simple dict
    await set_cached(
        cache_key_val,
        {
            str(k): {
                "num_messages_total": v.num_messages_total,
                "avg_response_sec": v.avg_response_sec,
            }
            for k, v in stats_map.items()
        },
        ttl=60,
        tags=["entries", "chat", "message_stats"],
    )

    return stats_map


@router.post(
    "/get",
    response_model=LeaderboardResponse,
    dependencies=[
        audit_activity(
            "artifacts.leaderboard.get",
            "{{ actor.name }} fetched leaderboard artifact data",
        )
    ],
)
async def get_leaderboard(
    request: LeaderboardRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardResponse:
    """Get leaderboard artifact data.

    Fetches chat-grain rows from attempt_chat_mv via get_chats_internal()
    and aggregates to profile-level leaderboard rows in Python.
    """
    tags = ["artifacts", "leaderboard", "views", "analytics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

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
        parsed_start_day = parsed_start_date.date() if parsed_start_date else None
        parsed_end_day = parsed_end_date.date() if parsed_end_date else None

        simulation_ids_filter = (
            request.simulation_ids
            if request.simulation_ids
            else ([request.simulation_id] if request.simulation_id else None)
        )
        cohort_ids_filter = (
            request.cohort_ids
            if request.cohort_ids
            else ([request.cohort_id] if request.cohort_id else None)
        )

        is_archived = bool(
            request.simulation_filters and "archived" in request.simulation_filters
        )
        if request.simulation_filters and "general" in request.simulation_filters:
            attempt_type = "general"
        elif request.simulation_filters and "practice" in request.simulation_filters:
            attempt_type = "practice"
        else:
            attempt_type = "general"

        # --- Single MV fetch: attempt_chat_mv ---
        async with pool.acquire() as c:
            chats_result = await get_chats_internal(
                conn=c,
                profile_id=request.target_profile_id,
                cohort_ids=cohort_ids_filter,
                department_ids=request.department_ids,
                simulation_ids=simulation_ids_filter,
                attempt_type=attempt_type,
                is_archived=is_archived,
                date_from=parsed_start_day,
                date_to=parsed_end_day,
                sort_by="date",
                sort_order=request.sort_order or "desc",
                page_limit=request.page_limit * 50,
                page_offset=0,
                bypass_cache=bypass_cache,
            )

        chat_items = chats_result.items

        # --- Fetch message stats (num_messages_total, avg_response_sec) ---
        chat_ids = [item.chat_id for item in chat_items]
        if chat_ids:
            async with pool.acquire() as c:
                message_stats_map = await get_message_stats_internal(
                    conn=c,
                    chat_ids=chat_ids,
                    bypass_cache=bypass_cache,
                )
        else:
            message_stats_map = {}

        # --- Fetch settings (same as before) ---
        primary_color = "#171717"
        accent_color = "#f5f5f5"
        actor_profile_for_settings = (
            request.actor_profile_id or request.target_profile_id
        )
        if actor_profile_for_settings:
            async with pool.acquire() as c:
                settings_row_raw = await execute_sql_typed(
                    c,
                    ACTIVE_SETTINGS_SQL_PATH,
                    params=GetActiveSettingsSqlParams(
                        profile_id=str(actor_profile_for_settings),
                        department_id=(
                            str(request.department_ids[0])
                            if request.department_ids
                            else None
                        ),
                    ),
                )
                if settings_row_raw:
                    settings = GetActiveSettingsSqlRow.model_validate(settings_row_raw)
                    primary_color = settings.primary_color or primary_color
                    accent_color = settings.accent or accent_color

        # --- Collect resource IDs from chat_items ---
        profile_id_set = {item.profile_id for item in chat_items}
        simulation_id_set = {item.simulation_id for item in chat_items}
        scenario_id_set = {
            item.scenario_id for item in chat_items if item.scenario_id is not None
        }

        # --- Hydrate resources in parallel ---
        async def fetch_profiles() -> list:
            async with pool.acquire() as c:
                return await get_profiles_internal(
                    conn=c,
                    ids=list(profile_id_set),
                    bypass_cache=bypass_cache,
                )

        async def fetch_simulations() -> list:
            async with pool.acquire() as c:
                return await get_simulations_internal(
                    conn=c,
                    ids=list(simulation_id_set),
                    bypass_cache=bypass_cache,
                )

        async def fetch_scenarios() -> list:
            async with pool.acquire() as c:
                return await get_scenarios_internal(
                    conn=c,
                    ids=list(scenario_id_set),
                    bypass_cache=bypass_cache,
                )

        profiles, simulations, scenarios = await asyncio.gather(
            fetch_profiles(),
            fetch_simulations(),
            fetch_scenarios(),
        )

        profile_name_by_id = {
            str(item.profile_id): item.name
            for item in profiles
            if item.profile_id is not None
        }

        # --- Build leaderboard rows and sections from chat items ---
        data = build_leaderboard_rows_v2(
            chat_items,
            profile_name_by_id=profile_name_by_id,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            rank_offset=request.page_offset,
            message_stats_map=message_stats_map,
        )

        # Paginate the profile-level rows
        page_start = request.page_offset
        page_end = request.page_offset + request.page_limit
        total_count = len(data)
        data_page = data[page_start:page_end]

        sections: LeaderboardSections = build_leaderboard_sections_v2(
            chat_items=chat_items,
            rows=data_page,
        )

        # Views: set to empty lists since we no longer fetch the 4 separate MVs
        views = LeaderboardViews(
            attempt_facts=[],
            chat_facts=[],
            daily_metrics=[],
            profile_metrics=[],
        )

        profile_resources = {
            str(item.profile_id): LeaderboardProfileResource(
                profile_id=str(item.profile_id),
                name=item.name,
                role=None,
            )
            for item in profiles
            if item.profile_id is not None
        }
        simulation_resources = {
            str(item.simulation_id): LeaderboardSimulationResource(
                simulation_id=str(item.simulation_id),
                name=item.name,
                description=item.description,
            )
            for item in simulations
            if item.simulation_id is not None
        }
        scenario_resources = {
            str(item.scenario_id): LeaderboardScenarioResource(
                scenario_id=str(item.scenario_id),
                name=item.name,
                description=item.description,
            )
            for item in scenarios
            if item.scenario_id is not None
        }

        resources = LeaderboardResources(
            profiles=profile_resources,
            simulations=simulation_resources,
            scenarios=scenario_resources,
        )

        simulation_options = [
            FilterOption(value=sid, label=simulation_resources[sid].name)
            for sid in simulation_resources
            if simulation_resources[sid].name
        ]
        profile_options = [
            FilterOption(value=pid, label=profile_resources[pid].name)
            for pid in profile_resources
            if profile_resources[pid].name
        ]

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return LeaderboardResponse(
            sections=sections,
            data=data_page,
            views=views,
            resources=resources,
            primary_color=primary_color,
            accent_color=accent_color,
            total_count=total_count,
            simulation_options=simulation_options,
            profile_options=profile_options,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_leaderboard_get",
            request=http_request,
        )
