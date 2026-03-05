"""Department artifact CREATE — tool layer."""

from uuid import UUID

import asyncpg

from app.infra.junctions import (
    insert_multi,
    insert_multi_with_value,
    insert_single,
)
from app.routes.v5.tools.artifacts.department.types import CreateDepartmentResponse

OWNER_COL = "department_id"

# (junction_table, resource_column)
SINGLE_JUNCTIONS: list[tuple[str, str]] = [
    ("department_names_junction", "name_id"),
    ("department_descriptions_junction", "description_id"),
]

MULTI_JUNCTIONS: list[tuple[str, str]] = [
    ("department_departments_junction", "departments_id"),
    ("department_settings_junction", "settings_id"),
]


async def create_department(
    conn: asyncpg.Connection,
    *,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    flag_ids: dict[UUID, bool] | None = None,
    settings_ids: list[UUID] | None = None,
    active: bool = True,
    generated: bool = False,
    mcp: bool = False,
) -> CreateDepartmentResponse:
    """Create a department artifact with optional junction links."""
    department_id: UUID = await conn.fetchval(
        """
        INSERT INTO department_artifact (active, generated, mcp)
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
                owner_id=department_id,
                resource_col=col,
                resource_id=val,
                generated=generated,
                mcp=mcp,
            )

    # Multi-select junctions (simple)
    multi_vals = [department_ids, settings_ids]
    for (table, col), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals:
            await insert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=department_id,
                resource_col=col,
                resource_ids=vals,
                generated=generated,
                mcp=mcp,
            )

    # Flags with value
    if flag_ids:
        await insert_multi_with_value(
            conn,
            table="department_flags_junction",
            owner_col=OWNER_COL,
            owner_id=department_id,
            resource_col="flag_id",
            resource_values=flag_ids,
            generated=generated,
            mcp=mcp,
        )

    return CreateDepartmentResponse(id=department_id)
