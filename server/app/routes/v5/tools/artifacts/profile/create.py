"""Profile artifact CREATE — tool layer."""

from uuid import UUID

import asyncpg

from app.infra.junctions import (
    insert_multi,
    insert_single,
)
from app.routes.v5.tools.artifacts.profile.types import CreateProfileResponse

OWNER_COL = "profile_id"

# (junction_table, resource_column)
SINGLE_JUNCTIONS: list[tuple[str, str]] = [
    ("profile_names_junction", "names_id"),
    ("profile_request_limits_junction", "request_limits_id"),
]

MULTI_JUNCTIONS: list[tuple[str, str]] = [
    ("profile_departments_junction", "departments_id"),
    ("profile_emails_junction", "emails_id"),
    ("profile_roles_junction", "roles_id"),
    ("profile_profiles_junction", "profiles_id"),
]


async def create_profile(
    conn: asyncpg.Connection,
    *,
    name_id: UUID | None = None,
    request_limit_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    flag_ids: list[UUID] | None = None,
    email_ids: list[UUID] | None = None,
    role_ids: list[UUID] | None = None,
    profile_ids: list[UUID] | None = None,
    active: bool = True,
    generated: bool = False,
    mcp: bool = False,
) -> CreateProfileResponse:
    """Create a profile artifact with optional junction links."""
    profile_id: UUID = await conn.fetchval(
        """
        INSERT INTO profile_artifact (active, generated, mcp)
        VALUES ($1, $2, $3)
        RETURNING id
        """,
        active,
        generated,
        mcp,
    )

    # Single-select junctions
    single_vals = [name_id, request_limit_id]
    for (table, col), val in zip(SINGLE_JUNCTIONS, single_vals):
        if val is not None:
            await insert_single(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=profile_id,
                resource_col=col,
                resource_id=val,
                generated=generated,
                mcp=mcp,
            )

    # Multi-select junctions (simple)
    multi_vals = [
        department_ids,
        email_ids,
        role_ids,
        profile_ids,
    ]
    for (table, col), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals:
            await insert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=profile_id,
                resource_col=col,
                resource_ids=vals,
                generated=generated,
                mcp=mcp,
            )

    # Flags
    if flag_ids:
        await insert_multi(
            conn,
            table="profile_flags_junction",
            owner_col=OWNER_COL,
            owner_id=profile_id,
            resource_col="flags_id",
            resource_ids=flag_ids,
            generated=generated,
            mcp=mcp,
        )

    return CreateProfileResponse(id=profile_id)
