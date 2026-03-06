"""Profile artifact UPDATE — tool layer.

Efficient junction updates: only deactivate removed IDs, upsert new ones,
and touch (updated_at) unchanged ones.
"""

from typing import Any
from uuid import UUID

import asyncpg

from app.infra.junctions import (
    upsert_multi,
    upsert_single,
)
from app.routes.v5.tools.artifacts.profile.types import UpdateProfileResponse

_UNSET: Any = object()

OWNER_COL = "profile_id"

# (junction_table, resource_column, pk_constraint)
SINGLE_JUNCTIONS: list[tuple[str, str, str]] = [
    ("profile_names_junction", "names_id", "profile_names_pkey"),
    (
        "profile_request_limits_junction",
        "request_limits_id",
        "profile_request_limits_pkey",
    ),
]

MULTI_JUNCTIONS: list[tuple[str, str, str]] = [
    ("profile_departments_junction", "departments_id", "profile_departments_pkey"),
    ("profile_emails_junction", "emails_id", "profile_emails_pkey"),
    ("profile_roles_junction", "roles_id", "profile_roles_pkey"),
    ("profile_profiles_junction", "profiles_id", "profile_profiles_junction_pkey"),
]


async def update_profile(
    conn: asyncpg.Connection,
    profile_id: UUID,
    *,
    # Single-select junctions (_UNSET = don't change)
    name_id: UUID | Any = _UNSET,
    request_limit_id: UUID | Any = _UNSET,
    # Multi-select junctions (None = don't change, [] = remove all)
    department_ids: list[UUID] | None = None,
    flag_ids: list[UUID] | None = None,
    email_ids: list[UUID] | None = None,
    role_ids: list[UUID] | None = None,
    profile_ids: list[UUID] | None = None,
    # Base columns
    active: bool | Any = _UNSET,
    mcp: bool = False,
) -> UpdateProfileResponse:
    """Update a profile artifact with efficient junction diffs."""
    # 1. Update artifact row
    if active is not _UNSET:
        await conn.execute(
            "UPDATE profile_artifact SET updated_at = NOW(), active = $2, mcp = $3 "
            "WHERE id = $1",
            profile_id,
            active,
            mcp,
        )
    else:
        await conn.execute(
            "UPDATE profile_artifact SET updated_at = NOW(), mcp = $2 WHERE id = $1",
            profile_id,
            mcp,
        )

    # 2. Single-select junctions
    single_vals = [name_id, request_limit_id]
    for (table, col, constraint), val in zip(SINGLE_JUNCTIONS, single_vals):
        if val is not _UNSET:
            await upsert_single(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=profile_id,
                resource_col=col,
                resource_id=val,
                constraint=constraint,
                mcp=mcp,
            )

    # 3. Multi-select junctions (simple)
    multi_vals: list[list[UUID] | None] = [
        department_ids,
        email_ids,
        role_ids,
        profile_ids,
    ]
    for (table, col, constraint), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals is not None:
            await upsert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=profile_id,
                resource_col=col,
                resource_ids=vals,
                constraint=constraint,
                mcp=mcp,
            )

    # 4. Flags
    if flag_ids is not None:
        await upsert_multi(
            conn,
            table="profile_flags_junction",
            owner_col=OWNER_COL,
            owner_id=profile_id,
            resource_col="flags_id",
            resource_ids=flag_ids,
            constraint="profile_flags_pkey",
            mcp=mcp,
        )

    return UpdateProfileResponse(id=profile_id)
