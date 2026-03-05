"""Persona artifact CREATE — tool layer."""

from uuid import UUID

import asyncpg

from app.infra.junctions import (
    insert_multi,
    insert_multi_with_idx,
    insert_multi_with_value,
    insert_single,
)
from app.routes.v5.tools.artifacts.persona.types import CreatePersonaResponse

OWNER_COL = "persona_id"

# (junction_table, resource_column)
SINGLE_JUNCTIONS: list[tuple[str, str]] = [
    ("persona_names_junction", "name_id"),
    ("persona_descriptions_junction", "description_id"),
    ("persona_colors_junction", "color_id"),
    ("persona_icons_junction", "icon_id"),
    ("persona_instructions_junction", "instruction_id"),
]

MULTI_JUNCTIONS: list[tuple[str, str]] = [
    ("persona_departments_junction", "department_id"),
    ("persona_parameter_fields_junction", "parameter_field_id"),
    ("persona_personas_junction", "personas_id"),
    ("persona_voices_junction", "voice_id"),
]


async def create_persona(
    conn: asyncpg.Connection,
    *,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    color_id: UUID | None = None,
    icon_id: UUID | None = None,
    instruction_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    example_ids: list[UUID] | None = None,
    flag_ids: dict[UUID, bool] | None = None,
    parameter_field_ids: list[UUID] | None = None,
    persona_ids: list[UUID] | None = None,
    voice_ids: list[UUID] | None = None,
    active: bool = True,
    generated: bool = False,
    mcp: bool = False,
) -> CreatePersonaResponse:
    """Create a persona artifact with optional junction links."""
    persona_id: UUID = await conn.fetchval(
        """
        INSERT INTO persona_artifact (active, generated, mcp)
        VALUES ($1, $2, $3)
        RETURNING id
        """,
        active,
        generated,
        mcp,
    )

    # Single-select junctions
    single_vals = [name_id, description_id, color_id, icon_id, instruction_id]
    for (table, col), val in zip(SINGLE_JUNCTIONS, single_vals):
        if val is not None:
            await insert_single(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=persona_id,
                resource_col=col,
                resource_id=val,
                generated=generated,
                mcp=mcp,
            )

    # Multi-select junctions (simple)
    multi_vals = [department_ids, parameter_field_ids, persona_ids, voice_ids]
    for (table, col), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals:
            await insert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=persona_id,
                resource_col=col,
                resource_ids=vals,
                generated=generated,
                mcp=mcp,
            )

    # Examples with idx
    if example_ids:
        await insert_multi_with_idx(
            conn,
            table="persona_examples_junction",
            owner_col=OWNER_COL,
            owner_id=persona_id,
            resource_col="example_id",
            resource_ids=example_ids,
            generated=generated,
            mcp=mcp,
        )

    # Flags with value
    if flag_ids:
        await insert_multi_with_value(
            conn,
            table="persona_flags_junction",
            owner_col=OWNER_COL,
            owner_id=persona_id,
            resource_col="flag_id",
            resource_values=flag_ids,
            generated=generated,
            mcp=mcp,
        )

    return CreatePersonaResponse(id=persona_id)
