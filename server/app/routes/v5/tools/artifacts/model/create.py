"""Model artifact CREATE — tool layer."""

from uuid import UUID

import asyncpg

from app.infra.junctions import (
    insert_multi,
    insert_multi_with_value,
    insert_single,
)
from app.routes.v5.tools.artifacts.model.types import CreateModelResponse

OWNER_COL = "model_id"

# (junction_table, resource_column)
SINGLE_JUNCTIONS: list[tuple[str, str]] = [
    ("model_names_junction", "name_id"),
    ("model_descriptions_junction", "description_id"),
]

MULTI_JUNCTIONS: list[tuple[str, str]] = [
    ("model_departments_junction", "department_id"),
    ("model_modalities_junction", "modality_id"),
    ("model_models_junction", "models_id"),
    ("model_pricing_junction", "pricing_id"),
    ("model_providers_junction", "providers_id"),
    ("model_qualities_junction", "quality_id"),
    ("model_reasoning_levels_junction", "reasoning_level_id"),
    ("model_temperature_levels_junction", "temperature_level_id"),
    ("model_values_junction", "value_id"),
    ("model_voices_junction", "voice_id"),
]


async def create_model(
    conn: asyncpg.Connection,
    *,
    name_id: UUID | None = None,
    description_id: UUID | None = None,
    department_ids: list[UUID] | None = None,
    flag_ids: dict[UUID, bool] | None = None,
    modality_ids: list[UUID] | None = None,
    model_ids: list[UUID] | None = None,
    pricing_ids: list[UUID] | None = None,
    provider_ids: list[UUID] | None = None,
    quality_ids: list[UUID] | None = None,
    reasoning_level_ids: list[UUID] | None = None,
    temperature_level_ids: list[UUID] | None = None,
    value_ids: list[UUID] | None = None,
    voice_ids: list[UUID] | None = None,
    active: bool = True,
    generated: bool = False,
    mcp: bool = False,
) -> CreateModelResponse:
    """Create a model artifact with optional junction links."""
    model_id: UUID = await conn.fetchval(
        """
        INSERT INTO model_artifact (active, generated, mcp)
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
                owner_id=model_id,
                resource_col=col,
                resource_id=val,
                generated=generated,
                mcp=mcp,
            )

    # Multi-select junctions (simple)
    multi_vals = [
        department_ids,
        modality_ids,
        model_ids,
        pricing_ids,
        provider_ids,
        quality_ids,
        reasoning_level_ids,
        temperature_level_ids,
        value_ids,
        voice_ids,
    ]
    for (table, col), vals in zip(MULTI_JUNCTIONS, multi_vals):
        if vals:
            await insert_multi(
                conn,
                table=table,
                owner_col=OWNER_COL,
                owner_id=model_id,
                resource_col=col,
                resource_ids=vals,
                generated=generated,
                mcp=mcp,
            )

    # Flags with value
    if flag_ids:
        await insert_multi_with_value(
            conn,
            table="model_flags_junction",
            owner_col=OWNER_COL,
            owner_id=model_id,
            resource_col="flag_id",
            resource_values=flag_ids,
            generated=generated,
            mcp=mcp,
        )

    return CreateModelResponse(id=model_id)
