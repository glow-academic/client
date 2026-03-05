"""Field artifact CREATE — tool layer."""

from uuid import UUID

import asyncpg

from app.infra.junctions import (
    insert_multi,
    insert_multi_with_value,
    insert_single,
)
from app.routes.v5.tools.artifacts.field.types import CreateFieldResponse

OWNER_COL = "field_id"

# (junction_table, resource_column)
SINGLE_JUNCTIONS: list[tuple[str, str]] = [
    ("field_names_junction", "name_id"),
    ("field_descriptions_junction", "description_id"),
]

MULTI_JUNCTIONS: list[tuple[str, str]] = [
    ("field_departments_junction", "department_id"),
    ("field_conditional_parameters_junction", "conditional_parameter_id"),
    ("field_fields_junction", "fields_id"),
]


async def create_field(
    conn: asyncpg.Connection,
    *,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    flag_ids: dict[UUID, bool] | None = None,
    conditional_parameter_ids: list[UUID] | None = None,
    field_ids: list[UUID] | None = None,
    active: bool = True,
    generated: bool = False,
    mcp: bool = False,
) -> CreateFieldResponse:
    """Create a field artifact with optional junction links."""
    field_id: UUID = await conn.fetchval(
        """
        INSERT INTO field_artifact (active, generated, mcp)
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
                owner_id=field_id,
                resource_col=col,
                resource_id=val,
                generated=generated,
                mcp=mcp,
            )

    # Multi-select junctions (simple)
    multi_vals = [department_ids, conditional_parameter_ids, field_ids]
    for (table, col), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals:
            await insert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=field_id,
                resource_col=col,
                resource_ids=vals,
                generated=generated,
                mcp=mcp,
            )

    # Flags with value
    if flag_ids:
        await insert_multi_with_value(
            conn,
            table="field_flags_junction",
            owner_col=OWNER_COL,
            owner_id=field_id,
            resource_col="flag_id",
            resource_values=flag_ids,
            generated=generated,
            mcp=mcp,
        )

    return CreateFieldResponse(id=field_id)
