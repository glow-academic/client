"""Invocation drafts CREATE — insert entry + connection tables."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.invocation_drafts.types import CreateInvocationDraftResponse


async def create_invocation_draft(
    conn: asyncpg.Connection,
    group_id: UUID,
    session_id: UUID,
    version: int = 0,
    mcp: bool = False,
    department_ids: list[UUID] | None = None,
    description_ids: list[UUID] | None = None,
    flag_ids: list[UUID] | None = None,
    key_ids: list[UUID] | None = None,
    model_flag_ids: list[UUID] | None = None,
    model_position_ids: list[UUID] | None = None,
    model_rubric_ids: list[UUID] | None = None,
    name_ids: list[UUID] | None = None,
    profile_ids: list[UUID] | None = None,
    reasoning_level_ids: list[UUID] | None = None,
    temperature_level_ids: list[UUID] | None = None,
    voice_ids: list[UUID] | None = None,
) -> CreateInvocationDraftResponse:
    """Create an invocation_drafts entry with optional connection table links."""
    draft_id = await conn.fetchval(
        """
        INSERT INTO invocation_drafts_entry (group_id, session_id, version, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        group_id,
        session_id,
        version,
        mcp,
    )

    if draft_id is None:
        raise ValueError("Failed to create invocation_drafts entry")

    connections: list[tuple[str, str, list[UUID]]] = [
        ("invocation_drafts_departments_connection", "departments_id", department_ids or []),
        ("invocation_drafts_descriptions_connection", "descriptions_id", description_ids or []),
        ("invocation_drafts_flags_connection", "flags_id", flag_ids or []),
        ("invocation_drafts_keys_connection", "keys_id", key_ids or []),
        ("invocation_drafts_model_flags_connection", "model_flags_id", model_flag_ids or []),
        ("invocation_drafts_model_positions_connection", "model_positions_id", model_position_ids or []),
        ("invocation_drafts_model_rubrics_connection", "model_rubrics_id", model_rubric_ids or []),
        ("invocation_drafts_names_connection", "names_id", name_ids or []),
        ("invocation_drafts_profiles_connection", "profiles_id", profile_ids or []),
        ("invocation_drafts_reasoning_levels_connection", "reasoning_levels_id", reasoning_level_ids or []),
        ("invocation_drafts_temperature_levels_connection", "temperature_levels_id", temperature_level_ids or []),
        ("invocation_drafts_voices_connection", "voices_id", voice_ids or []),
    ]

    for table, col, ids in connections:
        for rid in ids:
            await conn.execute(
                f"INSERT INTO {table} (draft_id, {col}) VALUES ($1, $2)",
                draft_id,
                rid,
            )

    return CreateInvocationDraftResponse(id=draft_id)
