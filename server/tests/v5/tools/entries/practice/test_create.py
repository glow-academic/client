"""Tests for create_practice."""

import pytest

from app.routes.v5.tools.entries.practice.create import create_practice
from app.routes.v5.tools.entries.practice.get import get_practices
from app.routes.v5.tools.entries.practice.refresh import refresh_practice
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import (
    PRACTICE_COHORT_RESOURCE_ID,
    SEED_SIMULATION_AVAILABILITY_ID,
    SEED_SIMULATION_POSITION_ID,
    SEED_SIMULATION_RESOURCE_ID,
    SUPERADMIN_PROFILE_PERSONA_ID,
    SUPERADMIN_PROFILES_RESOURCE_ID,
    UNIVERSITY_DEPT_ID,
)

pytestmark = pytest.mark.asyncio


async def _practice(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    return await create_practice(
        conn,
        session_id=session.id,
        cohorts_ids=[PRACTICE_COHORT_RESOURCE_ID],
        departments_ids=[UNIVERSITY_DEPT_ID],
        simulations_ids=[SEED_SIMULATION_RESOURCE_ID],
        profiles_ids=[SUPERADMIN_PROFILES_RESOURCE_ID],
        profile_personas_ids=[SUPERADMIN_PROFILE_PERSONA_ID],
        simulation_availability_ids=[SEED_SIMULATION_AVAILABILITY_ID],
        simulation_positions_ids=[SEED_SIMULATION_POSITION_ID],
    )


async def test_returns_id(conn):
    result = await _practice(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _practice(conn)
    await refresh_practice(conn)

    items = await get_practices(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].active is True


async def test_connections_populated(conn):
    result = await _practice(conn)
    await refresh_practice(conn)

    items = await get_practices(conn, [result.id])

    assert len(items) == 1
    practice = items[0]
    assert SEED_SIMULATION_RESOURCE_ID in practice.simulation_ids
    assert PRACTICE_COHORT_RESOURCE_ID in practice.cohort_ids
    assert UNIVERSITY_DEPT_ID in practice.department_ids
    assert SUPERADMIN_PROFILES_RESOURCE_ID in practice.profile_ids


async def test_passes_mcp_flag(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    result = await create_practice(
        conn,
        session_id=session.id,
        cohorts_ids=[PRACTICE_COHORT_RESOURCE_ID],
        departments_ids=[UNIVERSITY_DEPT_ID],
        simulations_ids=[SEED_SIMULATION_RESOURCE_ID],
        profiles_ids=[SUPERADMIN_PROFILES_RESOURCE_ID],
        profile_personas_ids=[SUPERADMIN_PROFILE_PERSONA_ID],
        simulation_availability_ids=[SEED_SIMULATION_AVAILABILITY_ID],
        simulation_positions_ids=[SEED_SIMULATION_POSITION_ID],
        mcp=True,
    )

    row = await conn.fetchrow(
        "SELECT mcp FROM practice_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
