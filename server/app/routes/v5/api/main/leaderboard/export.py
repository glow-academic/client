"""Leaderboard export endpoint — analytical profile-level CSV dump."""

import asyncio
import csv
import io
import os
from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.leaderboard.permissions import build_leaderboard_rows_v2
from app.routes.v5.api.main.leaderboard.types import (
    ExportLeaderboardApiRequest,
    ExportLeaderboardApiResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.entries.attempt_chat.get import get_chats_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import UPLOAD_FOLDER, get_db, get_pool
from app.sql.types import (
    InsertUploadSqlParams,
    InsertUploadSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

from .get import MessageStats, get_message_stats_internal

UPLOAD_SQL_PATH = "app/sql/queries/uploads/insert_upload_complete.sql"

PIPE = "|"

CSV_COLUMNS = [
    "rank",
    "profile_id",
    "name",
    "total_attempts",
    "highest_score",
    "messages_per_session",
    "persona_response_seconds",
    "time_spent_minutes",
    "improvement_rate",
    "perfect_score_count",
    "quickest_pass_minutes",
    "simulations",
    "scenarios",
]

router = APIRouter()


def _metric_current(metric: object | None) -> str:
    """Extract current_value from a LeaderboardMetric, or empty string."""
    if metric is None:
        return ""
    val = getattr(metric, "current_value", None)
    if val is None:
        return ""
    return str(val)


def _pipe_strings(vals: list[str] | None) -> str:
    """Format a list of strings as pipe-delimited string."""
    if not vals:
        return ""
    return PIPE.join(vals)


@router.post("/export", response_model=ExportLeaderboardApiResponse)
async def export_leaderboard(
    request: ExportLeaderboardApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ExportLeaderboardApiResponse:
    """Export leaderboard as CSV — profile-level aggregated metrics."""

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

        actor_name = None
        async with pool.acquire() as context_conn:
            profile_ctx = await get_auth_profile_internal(
                conn=context_conn,
                profile_id=profile_id,
                bypass_cache=False,
            )
            actor_name = profile_ctx.access.actor_name

        # Parse date filters
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

        # Fetch all chat-grain data (no pagination for export)
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
                page_limit=100000,
                page_offset=0,
                bypass_cache=True,
            )

        chat_items = chats_result.items

        # Fetch message stats
        chat_ids = [item.chat_id for item in chat_items]
        message_stats_map: dict[UUID, MessageStats] = {}
        if chat_ids:
            async with pool.acquire() as c:
                message_stats_map = await get_message_stats_internal(
                    conn=c,
                    chat_ids=chat_ids,
                    bypass_cache=True,
                )

        # Hydrate profile names
        from app.routes.v5.api.resources.profiles.get import get_profiles_internal
        from app.routes.v5.api.resources.scenarios.get import get_scenarios_internal
        from app.routes.v5.api.resources.simulations.get import get_simulations_internal

        profile_id_set = {item.profile_id for item in chat_items}
        simulation_id_set = {item.simulation_id for item in chat_items}
        scenario_id_set = {
            item.scenario_id for item in chat_items if item.scenario_id is not None
        }

        async def fetch_profiles() -> list:
            async with pool.acquire() as c:
                return await get_profiles_internal(
                    conn=c, ids=list(profile_id_set), bypass_cache=True
                )

        async def fetch_simulations() -> list:
            async with pool.acquire() as c:
                return await get_simulations_internal(
                    conn=c, ids=list(simulation_id_set), bypass_cache=True
                )

        async def fetch_scenarios() -> list:
            async with pool.acquire() as c:
                return await get_scenarios_internal(
                    conn=c, ids=list(scenario_id_set), bypass_cache=True
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
        simulation_name_by_id = {
            str(item.simulation_id): item.name
            for item in simulations
            if item.simulation_id is not None
        }
        scenario_name_by_id = {
            str(item.scenario_id): item.name
            for item in scenarios
            if item.scenario_id is not None
        }

        # Build profile-level rows (all rows, no pagination)
        data = build_leaderboard_rows_v2(
            chat_items,
            profile_name_by_id=profile_name_by_id,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            rank_offset=0,
            message_stats_map=message_stats_map,
        )

        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(CSV_COLUMNS)

        for row in data:
            me = row.metrics_entry

            # Resolve simulation/scenario names from IDs
            sim_names = [
                simulation_name_by_id.get(sid, sid)
                for sid in (row.simulation_ids or [])
            ]
            scen_names = [
                scenario_name_by_id.get(sid, sid) for sid in (row.scenario_ids or [])
            ]

            writer.writerow(
                [
                    row.rank or "",
                    row.profile_id or "",
                    row.name or "",
                    _metric_current(me.total_attempts if me else None),
                    _metric_current(me.highest_score_avg if me else None),
                    _metric_current(me.messages_per_session if me else None),
                    _metric_current(me.persona_response_seconds if me else None),
                    _metric_current(me.time_spent_minutes if me else None),
                    _metric_current(me.improvement_rate_per_day if me else None),
                    _metric_current(me.perfect_score_count if me else None),
                    _metric_current(me.quickest_pass_minutes if me else None),
                    _pipe_strings(sim_names),
                    _pipe_strings(scen_names),
                ]
            )

        csv_content = output.getvalue()
        row_count = len(data)

        # Write CSV to upload folder
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        file_name = f"leaderboard_export_{timestamp}.csv"
        file_path = os.path.join(str(UPLOAD_FOLDER), file_name)

        os.makedirs(str(UPLOAD_FOLDER), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(csv_content)

        # Insert into uploads_entry
        file_size = len(csv_content.encode("utf-8"))
        upload_params = InsertUploadSqlParams(
            file_path=file_name,
            mime_type="text/csv",
            size=file_size,
        )

        upload_result = cast(
            InsertUploadSqlRow,
            await execute_sql_typed(conn, UPLOAD_SQL_PATH, params=upload_params),
        )

        if not upload_result or not upload_result.id:
            raise ValueError("Failed to create upload record")

        upload_id = UUID(upload_result.id)

        # Audit
        return ExportLeaderboardApiResponse(
            upload_id=upload_id,
            file_name=file_name,
            row_count=row_count,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="export_leaderboard",
            request=http_request,
        )
