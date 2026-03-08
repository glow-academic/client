"""Setting export logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. search_settings — full dump (all IDs, no filters, no pagination)
  3. get_settings — hydrate junction IDs
  4. Resource get tools — parallel hydration (names, descriptions, etc.)
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
from app.routes.v5.tools.artifacts.setting.get import get_settings
from app.routes.v5.tools.artifacts.setting.search import search_settings
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.resources.colors.get import get_colors
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.profiles.get import get_profiles

PIPE = "|"

CSV_COLUMNS = [
    "setting_id",
    "name",
    "description",
    "active",
    "departments",
    "colors",
    "profiles",
]


async def export_setting_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    session_id: UUID,
) -> dict:
    """Setting full export using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, department_ids
      2. search_settings -> all IDs (full dump, no pagination)
      3. get_settings -> junction IDs per artifact
      4. Parallel resource hydration -> human-readable values
      5. Generate CSV + create upload entry
    """
    from fastapi import HTTPException

    from app.routes.v5.api.main.setting.types import ExportSettingApiResponse

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Search all settings (full dump) --

    setting_ids, _total_count = await search_settings(
        conn,
        active_only=False,
        limit_count=100000,
        offset_count=0,
    )

    if not setting_ids:
        return ExportSettingApiResponse(
            upload_id=UUID("00000000-0000-0000-0000-000000000000"),
            file_name="",
            row_count=0,
        )

    # -- Step 3: Get setting artifacts with all junction IDs --

    artifacts = await get_settings(
        conn,
        setting_ids,
        names=True,
        descriptions=True,
        departments=True,
        flags=True,
        colors=True,
        profiles=True,
    )

    # -- Step 4: Parallel resource hydration --

    all_name_ids: list[UUID] = []
    all_description_ids: list[UUID] = []
    all_department_ids: list[UUID] = []
    all_color_ids: list[UUID] = []
    all_profile_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_description_ids.extend(a.description_ids or [])
        all_department_ids.extend(a.department_ids or [])
        all_color_ids.extend(a.color_ids or [])
        all_profile_ids.extend(a.profile_ids or [])

    async def _empty() -> list:
        return []

    (
        names_data,
        descriptions_data,
        departments_data,
        colors_data,
        profiles_data,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty(),
        get_descriptions(conn, all_description_ids, redis)
        if all_description_ids
        else _empty(),
        get_departments(conn, all_department_ids, redis)
        if all_department_ids
        else _empty(),
        get_colors(conn, all_color_ids, redis) if all_color_ids else _empty(),
        get_profiles(conn, all_profile_ids, redis)
        if all_profile_ids
        else _empty(),
    )

    # Build lookup maps
    name_map = {n.id: n.name for n in names_data}
    description_map = {d.id: d.description for d in descriptions_data}
    department_map = {d.id: d.name for d in departments_data}
    color_map = {c.id: c.name for c in colors_data}
    profile_map = {p.id: p.name for p in profiles_data}

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
        colors_str = PIPE.join(
            color_map.get(cid, "") for cid in (a.color_ids or [])
        )
        profiles_str = PIPE.join(
            profile_map.get(pid, "") or "" for pid in (a.profile_ids or [])
        )

        writer.writerow(
            [
                str(a.id),
                name,
                description,
                active,
                departments_str,
                colors_str,
                profiles_str,
            ]
        )

    csv_content = output.getvalue()
    row_count = len(artifacts)

    # Write CSV to upload folder
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    file_name = f"settings_export_{timestamp}.csv"
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

    return ExportSettingApiResponse(
        upload_id=upload_result.id,
        file_name=file_name,
        row_count=row_count,
    )
