"""Auth artifact CREATE — tool layer."""

from uuid import UUID

import asyncpg

from app.infra.junctions import (
    insert_multi,
    insert_multi_with_value,
    insert_single,
)
from app.routes.v5.tools.artifacts.auth.types import CreateAuthResponse

OWNER_COL = "auth_id"

# (junction_table, resource_column)
SINGLE_JUNCTIONS: list[tuple[str, str]] = [
    ("auth_names_junction", "name_id"),
    ("auth_descriptions_junction", "description_id"),
    ("auth_slugs_junction", "slug_id"),
]

MULTI_JUNCTIONS: list[tuple[str, str]] = [
    ("auth_departments_junction", "department_id"),
    ("auth_items_junction", "item_id"),
    ("auth_protocols_junction", "protocol_id"),
    ("auth_auths_junction", "auths_id"),
]


async def create_auth(
    conn: asyncpg.Connection,
    *,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    slug_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    flag_ids: dict[UUID, bool] | None = None,
    item_ids: list[UUID] | None = None,
    protocol_ids: list[UUID] | None = None,
    auth_ids: list[UUID] | None = None,
    active: bool = True,
    generated: bool = False,
    mcp: bool = False,
) -> CreateAuthResponse:
    """Create an auth artifact with optional junction links."""
    auth_id: UUID = await conn.fetchval(
        """
        INSERT INTO auth_artifact (active, generated, mcp)
        VALUES ($1, $2, $3)
        RETURNING id
        """,
        active,
        generated,
        mcp,
    )

    # Single-select junctions
    single_vals = [name_id, description_id, slug_id]
    for (table, col), val in zip(SINGLE_JUNCTIONS, single_vals):
        if val is not None:
            await insert_single(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=auth_id,
                resource_col=col,
                resource_id=val,
                generated=generated,
                mcp=mcp,
            )

    # Multi-select junctions (simple)
    multi_vals = [department_ids, item_ids, protocol_ids, auth_ids]
    for (table, col), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals:
            await insert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=auth_id,
                resource_col=col,
                resource_ids=vals,
                generated=generated,
                mcp=mcp,
            )

    # Flags with value
    if flag_ids:
        await insert_multi_with_value(
            conn,
            table="auth_flags_junction",
            owner_col=OWNER_COL,
            owner_id=auth_id,
            resource_col="flag_id",
            resource_values=flag_ids,
            generated=generated,
            mcp=mcp,
        )

    return CreateAuthResponse(id=auth_id)
