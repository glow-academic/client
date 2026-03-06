"""Cohort drafts CREATE — insert entry + connection tables."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.cohort_drafts.types import CreateCohortDraftResponse


async def create_cohort_draft(
    conn: asyncpg.Connection,
    group_id: UUID,
    session_id: UUID,
    version: int = 0,
    mcp: bool = False,
    department_ids: list[UUID] | None = None,
    description_ids: list[UUID] | None = None,
    flag_ids: list[UUID] | None = None,
    name_ids: list[UUID] | None = None,
    profile_persona_ids: list[UUID] | None = None,
    profile_ids: list[UUID] | None = None,
    simulation_availability_ids: list[UUID] | None = None,
    simulation_position_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
) -> CreateCohortDraftResponse:
    """Create a cohort_drafts entry with optional connection table links."""
    draft_id = await conn.fetchval(
        """
        INSERT INTO cohort_drafts_entry (group_id, session_id, version, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        group_id,
        session_id,
        version,
        mcp,
    )

    if draft_id is None:
        raise ValueError("Failed to create cohort_drafts entry")

    connections: list[tuple[str, str, list[UUID]]] = [
        (
            "cohort_drafts_departments_connection",
            "departments_id",
            department_ids or [],
        ),
        (
            "cohort_drafts_descriptions_connection",
            "descriptions_id",
            description_ids or [],
        ),
        ("cohort_drafts_flags_connection", "flags_id", flag_ids or []),
        ("cohort_drafts_names_connection", "names_id", name_ids or []),
        (
            "cohort_drafts_profile_personas_connection",
            "profile_personas_id",
            profile_persona_ids or [],
        ),
        ("cohort_drafts_profiles_connection", "profiles_id", profile_ids or []),
        (
            "cohort_drafts_simulation_availability_connection",
            "simulation_availability_id",
            simulation_availability_ids or [],
        ),
        (
            "cohort_drafts_simulation_positions_connection",
            "simulation_positions_id",
            simulation_position_ids or [],
        ),
        (
            "cohort_drafts_simulations_connection",
            "simulations_id",
            simulation_ids or [],
        ),
    ]

    for table, col, ids in connections:
        for rid in ids:
            await conn.execute(
                f"INSERT INTO {table} (draft_id, {col}) VALUES ($1, $2)",
                draft_id,
                rid,
            )

    return CreateCohortDraftResponse(id=draft_id)
