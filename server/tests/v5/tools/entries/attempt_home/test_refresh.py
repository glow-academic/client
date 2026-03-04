"""Tests for refresh_attempt_home."""

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt_home.create import create_attempt_home
from app.routes.v5.tools.entries.attempt_home.refresh import refresh_attempt_home
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.home.create import create_home
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.runs.create import create_run
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

MV = "attempt_home_mv"


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    persona = await create_persona(conn)
    attempt = await create_attempt(
        conn,
        call_id=call.id,
        user_persona_id=persona.id,
        profiles_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    home = await create_home(
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
    return await create_attempt_home(
        conn,
        attempt_id=attempt.id,
        home_id=home.id,
        session_id=session.id,
    )


async def test_appears_after_refresh(conn):
    result = await _setup(conn)
    await refresh_attempt_home(conn)

    row = await conn.fetchrow(
        f"SELECT * FROM {MV} WHERE attempt_id = $1 AND home_id = $2",
        result.attempt_id,
        result.home_id,
    )
    assert row is not None


async def test_not_visible_before_refresh(conn):
    result = await _setup(conn)

    row = await conn.fetchrow(
        f"SELECT * FROM {MV} WHERE attempt_id = $1 AND home_id = $2",
        result.attempt_id,
        result.home_id,
    )
    assert row is None
