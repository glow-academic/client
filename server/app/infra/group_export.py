"""Group export logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. get_groups — group metadata by ID
  3. search_runs — all runs for this group
  4. compute_costs_from_runs — per-run cost computation
  5. get_names — hydrate agent/model names
  6. ZIP generation (groups.csv + runs.csv) + upload entry creation
"""

from __future__ import annotations

import csv
import io
import os
import zipfile
from datetime import datetime
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.globals import UPLOAD_FOLDER
from app.infra.pricing import compute_costs_from_runs
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.entries.groups.get import get_groups
from app.routes.v5.tools.entries.runs.search import search_runs
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.resources.names.get import get_names

PIPE = "|"

GROUP_CSV_COLUMNS = [
    "group_id",
    "group_name",
    "created_at",
    "active",
    "mcp",
]

RUN_CSV_COLUMNS = [
    "run_id",
    "group_id",
    "run_date",
    "input_tokens",
    "output_tokens",
    "cached_input_tokens",
    "agents",
    "models",
    "cost",
]


async def export_group_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    session_id: UUID,
    group_id: UUID,
) -> dict:
    """Group export using composable infra functions."""
    from fastapi import HTTPException

    from app.routes.v5.api.main.group.types import ExportGroupApiResponse

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Get group metadata --

    groups = await get_groups(conn, [group_id])

    if not groups:
        return ExportGroupApiResponse(
            upload_id=UUID("00000000-0000-0000-0000-000000000000"),
            file_name="",
            row_count=0,
        )

    # -- Step 3: Get runs for this group --

    runs, _total_count = await search_runs(
        conn, group_ids=[group_id], limit=100000, offset=0
    )

    # -- Step 4: Compute per-run costs --

    run_costs = await compute_costs_from_runs(conn, runs) if runs else {}

    # -- Step 5: Hydrate names --

    all_agent_ids: set[UUID] = set()
    all_model_ids: set[UUID] = set()

    for r in runs:
        if r.agent_ids:
            all_agent_ids.update(r.agent_ids)
        if r.model_ids:
            all_model_ids.update(r.model_ids)

    all_name_ids = list(all_agent_ids | all_model_ids)
    name_items = await get_names(conn, all_name_ids, redis) if all_name_ids else []
    name_map = {item.id: item.name for item in name_items if item.id and item.name}

    # -- Step 6: Generate ZIP (groups.csv + runs.csv) + upload --

    # Generate groups CSV
    groups_output = io.StringIO()
    groups_writer = csv.writer(groups_output)
    groups_writer.writerow(GROUP_CSV_COLUMNS)

    for g in groups:
        groups_writer.writerow(
            [
                str(g.id),
                g.name or "",
                str(g.created_at) if g.created_at else "",
                "Yes" if g.active else "No",
                "Yes" if g.mcp else "No",
            ]
        )

    # Generate runs CSV
    runs_output = io.StringIO()
    runs_writer = csv.writer(runs_output)
    runs_writer.writerow(RUN_CSV_COLUMNS)

    for r in runs:
        cost = run_costs.get(r.run_id, 0)
        agents_str = PIPE.join(name_map.get(aid, "") for aid in (r.agent_ids or []))
        models_str = PIPE.join(name_map.get(mid, "") for mid in (r.model_ids or []))

        runs_writer.writerow(
            [
                str(r.run_id),
                str(r.group_id) if r.group_id else "",
                str(r.run_created_at) if r.run_created_at else "",
                str(r.input_tokens),
                str(r.output_tokens),
                str(r.cached_input_tokens),
                agents_str,
                models_str,
                str(cost),
            ]
        )

    # Create ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("groups.csv", groups_output.getvalue())
        zf.writestr("runs.csv", runs_output.getvalue())

    zip_content = zip_buffer.getvalue()
    row_count = len(groups) + len(runs)

    # Write ZIP to upload folder
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    file_name = f"group_export_{timestamp}.zip"
    file_path = os.path.join(str(UPLOAD_FOLDER), file_name)

    os.makedirs(str(UPLOAD_FOLDER), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(zip_content)

    # Create upload entry via black-box tool
    file_size = len(zip_content)
    upload_result = await create_upload(
        conn,
        session_id=session_id,
        file_path=file_name,
        mime_type="application/zip",
        size=file_size,
    )

    return ExportGroupApiResponse(
        upload_id=upload_result.id,
        file_name=file_name,
        row_count=row_count,
    )
