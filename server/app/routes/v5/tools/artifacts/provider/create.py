"""Provider artifact CREATE — tool layer."""

from uuid import UUID

import asyncpg

from app.infra.junctions import (
    insert_multi,
    insert_multi_with_value,
    insert_single,
)
from app.routes.v5.tools.artifacts.provider.types import CreateProviderResponse

OWNER_COL = "provider_id"

# (junction_table, resource_column)
SINGLE_JUNCTIONS: list[tuple[str, str]] = [
    ("provider_names_junction", "name_id"),
    ("provider_descriptions_junction", "description_id"),
]

MULTI_JUNCTIONS: list[tuple[str, str]] = [
    ("provider_departments_junction", "department_id"),
    ("provider_endpoints_junction", "endpoint_id"),
    ("provider_keys_junction", "key_id"),
    ("provider_providers_junction", "providers_id"),
    ("provider_values_junction", "values_id"),
]


async def create_provider(
    conn: asyncpg.Connection,
    *,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    endpoint_ids: list[UUID] | None = None,
    flag_ids: dict[UUID, bool] | None = None,
    key_ids: list[UUID] | None = None,
    provider_ids: list[UUID] | None = None,
    value_ids: list[UUID] | None = None,
    active: bool = True,
    generated: bool = False,
    mcp: bool = False,
) -> CreateProviderResponse:
    """Create a provider artifact with optional junction links."""
    provider_id: UUID = await conn.fetchval(
        """
        INSERT INTO provider_artifact (active, generated, mcp)
        VALUES ($1, $2, $3)
        RETURNING id
        """,
        active,
        generated,
        mcp,
    )

    # Single-select junctions
    single_vals = [name_id, description_id]
    for (table, col), val in zip(SINGLE_JUNCTIONS, single_vals):
        if val is not None:
            await insert_single(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=provider_id,
                resource_col=col,
                resource_id=val,
                generated=generated,
                mcp=mcp,
            )

    # Multi-select junctions (simple)
    multi_vals = [department_ids, endpoint_ids, key_ids, provider_ids, value_ids]
    for (table, col), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals:
            await insert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=provider_id,
                resource_col=col,
                resource_ids=vals,
                generated=generated,
                mcp=mcp,
            )

    # Flags with value
    if flag_ids:
        await insert_multi_with_value(
            conn,
            table="provider_flags_junction",
            owner_col=OWNER_COL,
            owner_id=provider_id,
            resource_col="flag_id",
            resource_values=flag_ids,
            generated=generated,
            mcp=mcp,
        )

    return CreateProviderResponse(id=provider_id)
