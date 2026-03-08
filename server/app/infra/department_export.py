"""Department export logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. search_departments — full dump (all IDs, no filters, no pagination)
  3. get_departments (artifact) — hydrate junction IDs
  4. Resource get tools — parallel hydration (names, descriptions, settings)
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
from app.routes.v5.tools.artifacts.department.get import (
    get_departments as get_department_artifacts,
)
from app.routes.v5.tools.artifacts.department.search import search_departments
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.settings.get import get_settings

PIPE = "|"

CSV_COLUMNS = [
    "department_id",
    "name",
    "description",
    "active",
    "settings",
]


async def export_department_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    session_id: UUID,
) -> dict:
    """Department full export using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, department_ids
      2. search_departments -> all IDs (full dump, no pagination)
      3. get_departments (artifact) -> junction IDs per artifact
      4. Parallel resource hydration -> human-readable values
      5. Generate CSV + create upload entry
    """
    from fastapi import HTTPException

    from app.routes.v5.api.main.department.types import ExportDepartmentApiResponse

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Search all departments (full dump) --

    department_ids, _total_count = await search_departments(
        conn,
        active_only=False,
        limit_count=100000,
        offset_count=0,
    )

    if not department_ids:
        return ExportDepartmentApiResponse(
            upload_id=UUID("00000000-0000-0000-0000-000000000000"),
            file_name="",
            row_count=0,
        )

    # -- Step 3: Get department artifacts with all junction IDs --

    artifacts = await get_department_artifacts(
        conn,
        department_ids,
        names=True,
        descriptions=True,
        flags=True,
        settings=True,
    )

    # -- Step 4: Parallel resource hydration --

    all_name_ids: list[UUID] = []
    all_description_ids: list[UUID] = []
    all_settings_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_description_ids.extend(a.description_ids or [])
        all_settings_ids.extend(a.settings_ids or [])

    async def _empty() -> list:
        return []

    (
        names_data,
        descriptions_data,
        settings_data,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty(),
        get_descriptions(conn, all_description_ids, redis)
        if all_description_ids
        else _empty(),
        get_settings(conn, all_settings_ids, redis) if all_settings_ids else _empty(),
    )

    # Build lookup maps
    name_map = {n.id: n.name for n in names_data}
    description_map = {d.id: d.description for d in descriptions_data}
    setting_map = {s.id: s.name for s in settings_data}

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
        settings_str = PIPE.join(
            setting_map.get(sid, "") for sid in (a.settings_ids or [])
        )

        writer.writerow(
            [
                str(a.id),
                name,
                description,
                active,
                settings_str,
            ]
        )

    csv_content = output.getvalue()
    row_count = len(artifacts)

    # Write CSV to upload folder
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    file_name = f"departments_export_{timestamp}.csv"
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

    return ExportDepartmentApiResponse(
        upload_id=upload_result.id,
        file_name=file_name,
        row_count=row_count,
    )
