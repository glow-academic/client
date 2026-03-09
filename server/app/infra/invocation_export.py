"""Invocation export logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_invocation_context — draft-only resource hydration
  3. Flatten selected resources into denormalized CSV
  4. CSV generation + upload entry creation
"""

from __future__ import annotations

import csv
import io
import os
from datetime import datetime
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.globals import UPLOAD_FOLDER
from app.infra.invocation_context import resolve_invocation_context
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.entries.uploads.create import create_upload

PIPE = "|"

CSV_COLUMNS = [
    "test_id",
    "group_id",
    "draft_version",
    "name",
    "description",
    "active",
    "departments",
    "values",
    "keys",
    "endpoints",
    "modalities",
    "temperature_levels",
    "pricing",
    "reasoning_levels",
    "qualities",
    "voices",
]


async def export_invocation_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    session_id: UUID,
    test_id: UUID,
    group_id: UUID,
    invocation_entry_id: UUID | None = None,
    draft_id: UUID | None = None,
) -> dict:
    """Invocation single-item export using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. resolve_invocation_context → draft-only hydrated resources
      3. Flatten selected resources into denormalized CSV row
      4. Generate CSV + create upload entry
    """
    from fastapi import HTTPException

    from app.routes.v5.api.main.invocation.types import ExportInvocationApiResponse

    # ── Step 1: Profile context ────────────────────────────────────────

    async with pool.acquire() as conn:
        profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Resolve invocation context (draft-only) ────────────────

    ctx = await resolve_invocation_context(
        pool,
        redis,
        group_id=group_id,
        draft_id=draft_id,
    )

    # ── Step 3: Flatten selected resources into CSV row ─────────────────

    resources = ctx.resources

    # Single-select: first item's display value
    name = ""
    if resources.get("names") and resources["names"].selected:
        n = resources["names"].selected[0]
        name = getattr(n, "name", "") or ""

    description = ""
    if resources.get("descriptions") and resources["descriptions"].selected:
        d = resources["descriptions"].selected[0]
        description = getattr(d, "description", "") or ""

    # Active flag from flags
    active = "No"
    if resources.get("flags") and resources["flags"].selected:
        for f in resources["flags"].selected:
            if getattr(f, "name", "") == "invocation_active":
                active = "Yes"
                break

    # Multi-select: pipe-delimited display values
    departments_str = PIPE.join(
        getattr(d, "name", "") or ""
        for d in (
            resources.get("departments", None)
            and resources["departments"].selected
            or []
        )
    )
    values_str = PIPE.join(
        getattr(v, "value", "") or getattr(v, "name", "") or ""
        for v in (resources.get("values", None) and resources["values"].selected or [])
    )
    keys_str = PIPE.join(
        getattr(k, "key", "") or getattr(k, "name", "") or ""
        for k in (resources.get("keys", None) and resources["keys"].selected or [])
    )
    endpoints_str = PIPE.join(
        getattr(e, "endpoint", "") or getattr(e, "name", "") or ""
        for e in (
            resources.get("endpoints", None) and resources["endpoints"].selected or []
        )
    )
    modalities_str = PIPE.join(
        getattr(m, "modality", "") or getattr(m, "name", "") or ""
        for m in (
            resources.get("modalities", None) and resources["modalities"].selected or []
        )
    )
    temperature_levels_str = PIPE.join(
        getattr(t, "name", "") or ""
        for t in (
            resources.get("temperature_levels", None)
            and resources["temperature_levels"].selected
            or []
        )
    )
    pricing_str = PIPE.join(
        getattr(p, "name", "") or ""
        for p in (
            resources.get("pricing", None) and resources["pricing"].selected or []
        )
    )
    reasoning_levels_str = PIPE.join(
        getattr(r, "name", "") or ""
        for r in (
            resources.get("reasoning_levels", None)
            and resources["reasoning_levels"].selected
            or []
        )
    )
    qualities_str = PIPE.join(
        getattr(q, "name", "") or ""
        for q in (
            resources.get("qualities", None) and resources["qualities"].selected or []
        )
    )
    voices_str = PIPE.join(
        getattr(v, "voice", "") or getattr(v, "name", "") or ""
        for v in (resources.get("voices", None) and resources["voices"].selected or [])
    )

    # ── Step 4: Generate CSV + upload ──────────────────────────────────

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    writer.writerow(
        [
            str(test_id),
            str(group_id),
            str(ctx.draft_version or ""),
            name,
            description,
            active,
            departments_str,
            values_str,
            keys_str,
            endpoints_str,
            modalities_str,
            temperature_levels_str,
            pricing_str,
            reasoning_levels_str,
            qualities_str,
            voices_str,
        ]
    )

    csv_content = output.getvalue()
    row_count = 1

    # Write CSV to upload folder
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    file_name = f"invocation_export_{timestamp}.csv"
    file_path = os.path.join(str(UPLOAD_FOLDER), file_name)

    os.makedirs(str(UPLOAD_FOLDER), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(csv_content)

    # Create upload entry via black-box tool
    file_size = len(csv_content.encode("utf-8"))
    async with pool.acquire() as conn:
        upload_result = await create_upload(
            conn,
            session_id=session_id,
            file_path=file_name,
            mime_type="text/csv",
            size=file_size,
        )

    return ExportInvocationApiResponse(
        upload_id=upload_result.id,
        file_name=file_name,
        row_count=row_count,
    )
