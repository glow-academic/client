"""Tool artifact CREATE — tool layer."""

from uuid import UUID

import asyncpg

from app.infra.junctions import (
    insert_multi,
    insert_single,
)
from app.routes.v5.tools.artifacts.tool.types import CreateToolResponse

OWNER_COL = "tool_id"

# (junction_table, resource_column)
SINGLE_JUNCTIONS: list[tuple[str, str]] = [
    ("tool_names_junction", "names_id"),
    ("tool_descriptions_junction", "descriptions_id"),
]

MULTI_JUNCTIONS: list[tuple[str, str]] = [
    ("tool_departments_junction", "departments_id"),
    ("tool_arg_positions_junction", "arg_positions_id"),
    ("tool_args_junction", "args_id"),
    ("tool_args_outputs_junction", "args_outputs_id"),
    ("tool_artifacts_junction", "artifacts_id"),
    ("tool_entries_junction", "entries_id"),
    ("tool_operations_junction", "operations_id"),
    ("tool_resources_junction", "resources_id"),
    ("tool_tools_junction", "tools_id"),
]


async def create_tool(
    conn: asyncpg.Connection,
    *,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    arg_positions_ids: list[UUID] | None = None,
    args_ids: list[UUID] | None = None,
    args_outputs_ids: list[UUID] | None = None,
    artifact_ids: list[UUID] | None = None,
    entry_ids: list[UUID] | None = None,
    flag_ids: list[UUID] | None = None,
    operation_ids: list[UUID] | None = None,
    resource_ids: list[UUID] | None = None,
    tool_ids: list[UUID] | None = None,
    active: bool = True,
    generated: bool = False,
    mcp: bool = False,
) -> CreateToolResponse:
    """Create a tool artifact with optional junction links."""
    tool_id: UUID = await conn.fetchval(
        """
        INSERT INTO tool_artifact (active, generated, mcp)
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
                owner_id=tool_id,
                resource_col=col,
                resource_id=val,
                generated=generated,
                mcp=mcp,
            )

    # Multi-select junctions (simple)
    multi_vals = [
        department_ids,
        arg_positions_ids,
        args_ids,
        args_outputs_ids,
        artifact_ids,
        entry_ids,
        operation_ids,
        resource_ids,
        tool_ids,
    ]
    for (table, col), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals:
            await insert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=tool_id,
                resource_col=col,
                resource_ids=vals,
                generated=generated,
                mcp=mcp,
            )

    # Flags
    if flag_ids:
        await insert_multi(
            conn,
            table="tool_flags_junction",
            owner_col=OWNER_COL,
            owner_id=tool_id,
            resource_col="flags_id",
            resource_ids=flag_ids,
            generated=generated,
            mcp=mcp,
        )

    return CreateToolResponse(id=tool_id)
