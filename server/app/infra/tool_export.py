"""Tool export logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. search_tools — full dump (all IDs, no filters, no pagination)
  3. get_tools — hydrate junction IDs
  4. Resource get tools — parallel hydration (names, descriptions, args, etc.)
  5. CSV generation + upload entry creation
"""

from __future__ import annotations

import asyncio
import csv
import io
import os
from datetime import datetime
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.globals import UPLOAD_FOLDER
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.artifacts.tool.get import get_tools
from app.routes.v5.tools.artifacts.tool.search import search_tools
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.resources.arg_positions.get import get_arg_positions
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.get import get_names

PIPE = "|"

CSV_COLUMNS = [
    "tool_id",
    "name",
    "description",
    "active",
    "departments",
    "args",
    "arg_positions",
    "args_outputs",
]


async def export_tool_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    session_id: UUID,
    tool_id: UUID | None = None,
) -> dict:
    """Tool full export using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, department_ids
      2. search_tools -> all IDs (full dump, no pagination)
      3. get_tools -> junction IDs per artifact
      4. Parallel resource hydration -> human-readable values
      5. Generate CSV + create upload entry
    """
    from fastapi import HTTPException

    from app.routes.v5.api.main.tool.types import ExportToolApiResponse

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Search all tools (full dump) --

    if tool_id:
        tool_ids = [tool_id]
    else:
        tool_ids, _total_count = await search_tools(
            conn,
            active_only=False,
            limit_count=100000,
            offset_count=0,
        )

        if not tool_ids:
            return ExportToolApiResponse(
                upload_id=UUID("00000000-0000-0000-0000-000000000000"),
                file_name="",
                row_count=0,
            )

    # -- Step 3: Get tool artifacts with all junction IDs --

    artifacts = await get_tools(
        conn,
        tool_ids,
        names=True,
        descriptions=True,
        departments=True,
        flags=True,
        args=True,
        args_outputs=True,
        arg_positions=True,
    )

    # -- Step 4: Parallel resource hydration --

    all_name_ids: list[UUID] = []
    all_description_ids: list[UUID] = []
    all_department_ids: list[UUID] = []
    all_args_ids: list[UUID] = []
    all_arg_positions_ids: list[UUID] = []
    all_args_outputs_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_description_ids.extend(a.description_ids or [])
        all_department_ids.extend(a.department_ids or [])
        all_args_ids.extend(a.args_ids or [])
        all_arg_positions_ids.extend(a.arg_positions_ids or [])
        all_args_outputs_ids.extend(a.args_outputs_ids or [])

    async def _empty() -> list:
        return []

    (
        names_data,
        descriptions_data,
        departments_data,
        args_data,
        arg_positions_data,
        args_outputs_data,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty(),
        get_descriptions(conn, all_description_ids, redis)
        if all_description_ids
        else _empty(),
        get_departments(conn, all_department_ids, redis)
        if all_department_ids
        else _empty(),
        get_args(conn, all_args_ids, redis) if all_args_ids else _empty(),
        get_arg_positions(conn, all_arg_positions_ids, redis)
        if all_arg_positions_ids
        else _empty(),
        get_args_outputs(conn, all_args_outputs_ids, redis)
        if all_args_outputs_ids
        else _empty(),
    )

    # Build lookup maps
    name_map = {n.id: n.name for n in names_data}
    description_map = {d.id: d.description for d in descriptions_data}
    department_map = {d.id: d.name for d in departments_data}
    args_map = {a.id: a.name for a in args_data}
    # arg_positions: display as "arg_name:position"
    arg_name_by_id = {a.id: a.name for a in args_data}
    arg_position_map = {
        ap.id: f"{arg_name_by_id.get(ap.args_id, '')}:{ap.value}"
        for ap in arg_positions_data
    }
    args_output_map = {ao.id: ao.name for ao in args_outputs_data}

    # -- Step 5: Generate CSV + upload --

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    for a in artifacts:
        # Single-select: first resource value
        name = name_map.get(a.name_ids[0], "") if a.name_ids else ""
        description = (
            description_map.get(a.description_ids[0], "") if a.description_ids else ""
        )

        # Active flag
        active = "Yes" if a.active else "No"

        # Multi-select: pipe-delimited values
        departments_str = PIPE.join(
            department_map.get(did, "") for did in (a.department_ids or [])
        )
        args_str = PIPE.join(
            args_map.get(aid, "") for aid in (a.args_ids or [])
        )
        arg_positions_str = PIPE.join(
            arg_position_map.get(apid, "") for apid in (a.arg_positions_ids or [])
        )
        args_outputs_str = PIPE.join(
            args_output_map.get(aoid, "") for aoid in (a.args_outputs_ids or [])
        )

        writer.writerow(
            [
                str(a.id),
                name,
                description,
                active,
                departments_str,
                args_str,
                arg_positions_str,
                args_outputs_str,
            ]
        )

    csv_content = output.getvalue()
    row_count = len(artifacts)

    # Write CSV to upload folder
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    file_name = f"tools_export_{timestamp}.csv"
    file_path = os.path.join(str(UPLOAD_FOLDER), file_name)

    os.makedirs(str(UPLOAD_FOLDER), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(csv_content)

    # Create upload entry via black-box tool
    file_size = len(csv_content.encode("utf-8"))
    upload_result = await create_upload(
        conn,
        session_id=session_id,
        file_path=file_name,
        mime_type="text/csv",
        size=file_size,
    )

    return ExportToolApiResponse(
        upload_id=upload_result.id,
        file_name=file_name,
        row_count=row_count,
    )
