"""Profile export logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. search_profiles — full dump (all IDs, no filters, no pagination)
  3. get_profiles — hydrate junction IDs
  4. Resource get tools — parallel hydration (names, departments, emails, request_limits, roles)
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
from app.routes.v5.tools.artifacts.profile.get import get_profiles
from app.routes.v5.tools.artifacts.profile.search import search_profiles
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.emails.get import get_emails
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.request_limits.get import get_request_limits
from app.routes.v5.tools.resources.roles.get import get_roles

PIPE = "|"

CSV_COLUMNS = [
    "profile_id",
    "name",
    "active",
    "departments",
    "emails",
    "request_limit",
    "roles",
]


async def export_profile_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    session_id: UUID,
    profile_export_id: UUID | None = None,
) -> dict:
    """Profile full export using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. search_profiles → all IDs (full dump, no pagination)
      3. get_profiles → junction IDs per artifact
      4. Parallel resource hydration → human-readable values
      5. Generate CSV + create upload entry
    """
    from fastapi import HTTPException

    from app.routes.v5.api.main.profile.types import ExportProfileApiResponse

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Search all profiles (full dump) ──────────────────────

    if profile_export_id:
        profile_ids = [profile_export_id]
    else:
        profile_ids, _total_count = await search_profiles(
            conn,
            active_only=False,
            limit_count=100000,
            offset_count=0,
        )

        if not profile_ids:
            return ExportProfileApiResponse(
                upload_id=UUID("00000000-0000-0000-0000-000000000000"),
                file_name="",
                row_count=0,
            )

    # ── Step 3: Get profile artifacts with all junction IDs ──────────

    artifacts = await get_profiles(
        conn,
        profile_ids,
        names=True,
        departments=True,
        flags=True,
        emails=True,
        request_limits=True,
        roles=True,
    )

    # ── Step 4: Parallel resource hydration ────────────────────────────

    # Collect all resource IDs across artifacts
    all_name_ids: list[UUID] = []
    all_department_ids: list[UUID] = []
    all_email_ids: list[UUID] = []
    all_request_limit_ids: list[UUID] = []
    all_role_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_department_ids.extend(a.department_ids or [])
        all_email_ids.extend(a.email_ids or [])
        all_request_limit_ids.extend(a.request_limit_ids or [])
        all_role_ids.extend(a.role_ids or [])

    async def _empty() -> list:
        return []

    (
        names_data,
        departments_data,
        emails_data,
        request_limits_data,
        roles_data,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty(),
        get_departments(conn, all_department_ids, redis)
        if all_department_ids
        else _empty(),
        get_emails(conn, all_email_ids, redis) if all_email_ids else _empty(),
        get_request_limits(conn, all_request_limit_ids, redis)
        if all_request_limit_ids
        else _empty(),
        get_roles(conn, all_role_ids, redis) if all_role_ids else _empty(),
    )

    # Build lookup maps
    name_map = {n.id: n.name for n in names_data}
    department_map = {d.id: d.name for d in departments_data}
    email_map = {e.id: e.email for e in emails_data}
    request_limit_map = {
        rl.id: str(rl.requests_per_day) if rl.requests_per_day is not None else ""
        for rl in request_limits_data
    }
    role_map = {r.id: r.name for r in roles_data}

    # ── Step 5: Generate CSV + upload ──────────────────────────────────

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    for a in artifacts:
        # Single-select: first resource value
        name = name_map.get(a.name_ids[0], "") if a.name_ids else ""

        # Active flag
        active = "Yes" if a.active else "No"

        # Multi-select: pipe-delimited values
        departments_str = PIPE.join(
            department_map.get(did, "") for did in (a.department_ids or [])
        )
        emails_str = PIPE.join(email_map.get(eid, "") for eid in (a.email_ids or []))

        # Single-select: request limit
        request_limit = (
            request_limit_map.get(a.request_limit_ids[0], "")
            if a.request_limit_ids
            else ""
        )

        # Multi-select: roles
        roles_str = PIPE.join(role_map.get(rid, "") for rid in (a.role_ids or []))

        writer.writerow(
            [
                str(a.id),
                name,
                active,
                departments_str,
                emails_str,
                request_limit,
                roles_str,
            ]
        )

    csv_content = output.getvalue()
    row_count = len(artifacts)

    # Write CSV to upload folder
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    file_name = f"profiles_export_{timestamp}.csv"
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

    return ExportProfileApiResponse(
        upload_id=upload_result.id,
        file_name=file_name,
        row_count=row_count,
    )
