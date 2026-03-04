"""Tests for create_home."""

import pytest

from app.routes.v5.tools.entries.home.create import create_home
from app.routes.v5.tools.entries.home.get import get_homes
from app.routes.v5.tools.entries.home.refresh import refresh_home
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


async def _home(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    return await create_home(
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
    result = await _home(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _home(conn)
    await refresh_home(conn)

    items = await get_homes(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].active is True


async def test_connections_populated(conn):
    result = await _home(conn)
    await refresh_home(conn)

    items = await get_homes(conn, [result.id])

    assert len(items) == 1
    home = items[0]
    assert SEED_SIMULATION_RESOURCE_ID in home.simulation_ids
    assert PRACTICE_COHORT_RESOURCE_ID in home.cohort_ids
    assert UNIVERSITY_DEPT_ID in home.department_ids
    assert SUPERADMIN_PROFILES_RESOURCE_ID in home.profile_ids


async def test_passes_mcp_flag(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    result = await create_home(
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

    # MV doesn't expose mcp, verify via direct table read
    row = await conn.fetchrow(
        "SELECT mcp FROM home_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
