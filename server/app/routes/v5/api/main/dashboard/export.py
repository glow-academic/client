"""Dashboard export endpoint — chat-grain analytical CSV dump."""

import asyncio
import csv
import io
import os
from datetime import datetime
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import UPLOAD_FOLDER, get_db, get_pool, get_redis_client
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.dashboard.shared import get_message_stats_internal
from app.routes.v5.api.main.dashboard.types import (
    ExportDashboardApiRequest,
    ExportDashboardApiResponse,
)
from app.routes.v5.tools.entries.attempt_chat.get import get_chats_internal
from app.routes.v5.tools.resources.personas.get import get_personas_internal
from app.routes.v5.tools.resources.profiles.get import get_profiles
from app.routes.v5.tools.resources.scenarios.get import get_scenarios_internal
from app.routes.v5.tools.resources.simulations.get import get_simulations_internal
from app.sql.types import (
    InsertUploadSqlParams,
    InsertUploadSqlRow,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

UPLOAD_SQL_PATH = "app/sql/queries/uploads/insert_upload_complete.sql"

PIPE = "|"

CSV_COLUMNS = [
    "attempt_id",
    "attempt_date",
    "chat_id",
    "profile_id",
    "profile_name",
    "simulation",
    "scenario",
    "personas",
    "cohort",
    "department_id",
    "grade_percent",
    "passed",
    "completed",
    "time_taken_minutes",
    "messages",
    "avg_response_seconds",
    "attempt_type",
    "attempt_number",
]

router = APIRouter()


def _pipe_strings(vals: list[str] | None) -> str:
    """Format a list of strings as pipe-delimited string."""
    if not vals:
        return ""
    return PIPE.join(vals)


@router.post("/export", response_model=ExportDashboardApiResponse)
async def export_dashboard(
    request: ExportDashboardApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ExportDashboardApiResponse:
    """Export dashboard as CSV — chat-grain data with hydrated names."""

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

        is_archived = bool(
            request.simulation_filters and "archived" in request.simulation_filters
        )
        if request.simulation_filters and "general" in request.simulation_filters:
            attempt_type = "general"
        elif request.simulation_filters and "practice" in request.simulation_filters:
            attempt_type = "practice"
        else:
            attempt_type = None

        # Phase 1: Fetch all chat-grain data (no pagination)
        async with pool.acquire() as c:
            chats_result = await get_chats_internal(
                conn=c,
                profile_id=request.target_profile_id,
                cohort_ids=request.cohort_ids,
                department_ids=request.department_ids,
                simulation_ids=request.simulation_ids,
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

        # Phase 2: Collect resource IDs
        profile_ids_set: set[UUID] = set()
        simulation_ids_set: set[UUID] = set()
        persona_ids_set: set[UUID] = set()
        scenario_ids_set: set[UUID] = set()
        cohort_ids_set: set[UUID] = set()
        chat_ids: list[UUID] = []

        for item in chat_items:
            chat_ids.append(item.chat_id)
            profile_ids_set.add(item.profile_id)
            simulation_ids_set.add(item.simulation_id)
            if item.persona_ids:
                persona_ids_set.update(item.persona_ids)
            if item.scenario_id:
                scenario_ids_set.add(item.scenario_id)
            if item.cohort_id:
                cohort_ids_set.add(item.cohort_id)

        # Phase 3: Parallel resource hydration + message stats
        async def _get_profiles() -> list[Any]:
            async with pool.acquire() as c:
                return await get_profiles(
                    conn=c,
                    ids=list(profile_ids_set),
                    redis=get_redis_client(),
                    bypass_cache=True,
                )

        async def _get_simulations() -> list[Any]:
            async with pool.acquire() as c:
                return await get_simulations_internal(
                    conn=c, ids=list(simulation_ids_set), bypass_cache=True
                )

        async def _get_personas() -> list[Any]:
            async with pool.acquire() as c:
                return await get_personas_internal(
                    conn=c, ids=list(persona_ids_set), bypass_cache=True
                )

        async def _get_scenarios() -> list[Any]:
            async with pool.acquire() as c:
                return await get_scenarios_internal(
                    conn=c, ids=list(scenario_ids_set), bypass_cache=True
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

        async def _get_message_stats() -> dict:
            if not chat_ids:
                return {}
            async with pool.acquire() as c:
                return await get_message_stats_internal(
                    conn=c, chat_ids=chat_ids, bypass_cache=True
                )

        (
            profiles,
            simulations,
            personas,
            scenarios,
            cohort_rows,
            message_stats,
        ) = await asyncio.gather(
            _get_profiles(),
            _get_simulations(),
            _get_personas(),
            _get_scenarios(),
            _get_cohort_names(),
            _get_message_stats(),
        )

        # Build name maps
        profile_name_map: dict[str, str] = {
            str(p.profile_id): p.name for p in profiles if p.profile_id and p.name
        }
        simulation_name_map: dict[str, str] = {
            str(s.simulation_id): s.name
            for s in simulations
            if s.simulation_id and s.name
        }
        persona_name_map: dict[str, str] = {
            str(p.persona_id): p.name for p in personas if p.persona_id and p.name
        }
        scenario_name_map: dict[str, str] = {
            str(s.scenario_id): s.name for s in scenarios if s.scenario_id and s.name
        }
        cohort_name_map: dict[str, str] = {
            str(row["id"]): row["name"]
            for row in cohort_rows
            if row["id"] and row["name"]
        }

        # Enrich chat items with message stats
        for item in chat_items:
            stats = message_stats.get(item.chat_id)
            if stats:
                item.num_messages_total = stats.num_messages_total
                item.avg_response_sec = stats.avg_response_sec

        # Phase 4: Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(CSV_COLUMNS)

        for item in chat_items:
            # Resolve persona names
            p_names = [
                persona_name_map.get(str(pid), str(pid)) for pid in item.persona_ids
            ]

            # Compute time in minutes
            time_min = ""
            if item.grade_time_taken is not None:
                time_min = str(round(item.grade_time_taken / 60.0, 2))

            writer.writerow(
                [
                    str(item.attempt_id),
                    str(item.attempt_date) if item.attempt_date else "",
                    str(item.chat_id),
                    str(item.profile_id),
                    profile_name_map.get(str(item.profile_id), ""),
                    simulation_name_map.get(str(item.simulation_id), ""),
                    scenario_name_map.get(str(item.scenario_id), "")
                    if item.scenario_id
                    else "",
                    _pipe_strings(p_names),
                    cohort_name_map.get(str(item.cohort_id), "")
                    if item.cohort_id
                    else "",
                    str(item.department_id) if item.department_id else "",
                    str(item.grade_percent) if item.grade_percent is not None else "",
                    "Yes" if item.grade_passed else "No",
                    "Yes" if item.completed else "No",
                    time_min,
                    str(item.num_messages_total) if item.num_messages_total else "",
                    str(round(item.avg_response_sec, 2))
                    if item.avg_response_sec is not None
                    else "",
                    item.attempt_type or "",
                    str(item.attempt_number) if item.attempt_number else "",
                ]
            )

        csv_content = output.getvalue()
        row_count = len(chat_items)

        # Write CSV to upload folder
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        file_name = f"dashboard_export_{timestamp}.csv"
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
        return ExportDashboardApiResponse(
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
            operation="export_dashboard",
            request=http_request,
        )
