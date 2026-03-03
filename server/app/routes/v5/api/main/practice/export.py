"""Practice export endpoint — attempt-grain analytical CSV dump."""

import asyncio
import csv
import io
import os
from collections import defaultdict
from datetime import datetime
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.chat.permissions import compute_pass_pct
from app.routes.v5.api.main.practice.get import _compute_history_aggregates
from app.routes.v5.api.main.practice.types import (
    ExportPracticeApiRequest,
    ExportPracticeApiResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.entries.attempt.get import ChatViewItem, get_attempt_chats_internal
from app.routes.v5.api.entries.attempt.search import get_attempt_list_internal
from app.routes.v5.api.resources.personas.get import get_personas_internal
from app.routes.v5.api.resources.profiles.get import get_profiles_internal
from app.routes.v5.api.resources.scenarios.get import get_scenarios_internal
from app.routes.v5.api.resources.simulations.get import get_simulations_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import UPLOAD_FOLDER, get_db, get_pool
from app.sql.types import (
    InsertUploadSqlParams,
    InsertUploadSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

UPLOAD_SQL_PATH = "app/sql/queries/uploads/insert_upload_complete.sql"

PIPE = "|"

CSV_COLUMNS = [
    "attempt_id",
    "date",
    "profile_id",
    "profile_name",
    "simulation",
    "num_scenarios",
    "num_scenarios_completed",
    "personas",
    "scenarios",
    "score",
    "passed",
    "pass_pct",
    "time_limit",
    "infinite_mode",
    "is_archived",
]

router = APIRouter()


def _pipe_strings(vals: list[str] | None) -> str:
    """Format a list of strings as pipe-delimited string."""
    if not vals:
        return ""
    return PIPE.join(vals)


@router.post("/export", response_model=ExportPracticeApiResponse)
async def export_practice(
    request: ExportPracticeApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ExportPracticeApiResponse:
    """Export practice attempts as CSV — attempt-grain data with hydrated names."""

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

        # Resolve profile_id → profiles_resource_id
        async with pool.acquire() as c:
            profiles_resource_id = await c.fetchval(
                """
                SELECT profiles_id FROM profile_profiles_junction
                WHERE profile_id = $1 AND active = true
                LIMIT 1
                """,
                profile_id,
            )

        if not profiles_resource_id:
            raise HTTPException(
                status_code=400,
                detail="Could not resolve profile resource ID.",
            )

        # Step 1: Fetch ALL practice attempts (no pagination)
        async with pool.acquire() as c:
            list_result = await get_attempt_list_internal(
                conn=c,
                profile_id_filter=profiles_resource_id,
                practice_filter=True,
                is_archived_filter=request.history_show_archived,
                scenario_ids_filter=request.history_scenario_ids,
                infinite_mode_filter=request.history_infinite_mode,
                sort_by=request.sort_by or "date",
                sort_order=request.sort_order or "desc",
                page_limit=100000,
                page_offset=0,
                bypass_cache=True,
            )

        items = list_result.items or []

        # Step 2: Batch-fetch all chats for all attempts
        attempt_ids = [item.attempt_id for item in items]
        chats: list[ChatViewItem] = []
        if attempt_ids:
            async with pool.acquire() as c:
                chats = await get_attempt_chats_internal(
                    c, attempt_ids=attempt_ids, bypass_cache=True
                )

        # Step 3: Group chats by attempt_id and compute aggregates
        chats_by_attempt: dict[UUID, list[ChatViewItem]] = defaultdict(list)
        for chat in chats:
            if chat.attempt_id:
                chats_by_attempt[chat.attempt_id].append(chat)

        sim_ids_set: set[UUID] = set()
        profile_ids_set: set[UUID] = set()
        persona_ids_set: set[UUID] = set()
        scenario_ids_set: set[UUID] = set()
        aggregates_by_attempt: dict[UUID, dict[str, Any]] = {}

        for item in items:
            attempt_chats = chats_by_attempt.get(item.attempt_id, [])
            agg = _compute_history_aggregates(attempt_chats)
            aggregates_by_attempt[item.attempt_id] = agg
            if item.simulation_id:
                sim_ids_set.add(item.simulation_id)
            if item.profile_id:
                profile_ids_set.add(item.profile_id)
            if agg.get("persona_ids"):
                persona_ids_set.update(agg["persona_ids"])
            if agg.get("scenario_ids"):
                scenario_ids_set.update(agg["scenario_ids"])
            elif item.scenario_ids:
                scenario_ids_set.update(item.scenario_ids)

        # Step 4: Parallel resource hydration
        async def _get_sims() -> list[Any]:
            if not sim_ids_set:
                return []
            async with pool.acquire() as c:
                return await get_simulations_internal(
                    c, list(sim_ids_set), bypass_cache=True
                )

        async def _get_profiles() -> list[Any]:
            if not profile_ids_set:
                return []
            async with pool.acquire() as c:
                return await get_profiles_internal(
                    c, list(profile_ids_set), bypass_cache=True
                )

        async def _get_personas() -> list[Any]:
            if not persona_ids_set:
                return []
            async with pool.acquire() as c:
                return await get_personas_internal(
                    c, list(persona_ids_set), bypass_cache=True
                )

        async def _get_scenarios() -> list[Any]:
            if not scenario_ids_set:
                return []
            async with pool.acquire() as c:
                return await get_scenarios_internal(
                    c, list(scenario_ids_set), bypass_cache=True
                )

        sims, profs, pers, scens = await asyncio.gather(
            _get_sims(), _get_profiles(), _get_personas(), _get_scenarios()
        )

        sim_name_map: dict[str, str] = {
            str(s.simulation_id): s.name for s in sims if s.simulation_id and s.name
        }
        profile_name_map: dict[str, str] = {
            str(p.profile_id): p.name for p in profs if p.profile_id and p.name
        }
        persona_name_map: dict[str, str] = {
            str(p.persona_id): p.name for p in pers if p.persona_id and p.name
        }
        scenario_name_map: dict[str, str] = {
            str(s.scenario_id): s.name for s in scens if s.scenario_id and s.name
        }

        # Step 5: Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(CSV_COLUMNS)

        for item in items:
            agg = aggregates_by_attempt.get(item.attempt_id, {})

            # Resolve persona names
            p_names = [
                persona_name_map.get(str(pid), str(pid))
                for pid in (agg.get("persona_ids") or [])
            ]

            # Resolve scenario names
            s_ids = agg.get("scenario_ids") or (
                list(item.scenario_ids) if item.scenario_ids else []
            )
            s_names = [scenario_name_map.get(str(sid), str(sid)) for sid in s_ids]

            score_percent = agg.get("score_percent")
            score = round(score_percent) if score_percent is not None else ""
            has_passed = agg.get("has_passed", False)

            pass_pct = compute_pass_pct(
                agg.get("rubric_total_points"), agg.get("rubric_pass_points")
            )

            writer.writerow(
                [
                    str(item.attempt_id),
                    item.created_at.isoformat() if item.created_at else "",
                    str(item.profile_id) if item.profile_id else "",
                    profile_name_map.get(str(item.profile_id), "")
                    if item.profile_id
                    else "",
                    sim_name_map.get(str(item.simulation_id), "")
                    if item.simulation_id
                    else "",
                    agg.get("num_scenarios", ""),
                    agg.get("num_scenarios_completed", ""),
                    _pipe_strings(p_names),
                    _pipe_strings(s_names),
                    score,
                    "Yes" if has_passed else "No",
                    str(pass_pct) if pass_pct is not None else "",
                    "",  # time_limit — would need simulation resource
                    "Yes" if item.infinite_mode else "No",
                    "Yes" if item.is_archived else "No",
                ]
            )

        csv_content = output.getvalue()
        row_count = len(items)

        # Write CSV to upload folder
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        file_name = f"practice_export_{timestamp}.csv"
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
        return ExportPracticeApiResponse(
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
            operation="export_practice",
            request=http_request,
        )
