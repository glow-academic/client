"""Tests for refresh_attempt_practice."""

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt_practice.create import create_attempt_practice
from app.routes.v5.tools.entries.attempt_practice.get import get_attempt_practice
from app.routes.v5.tools.entries.attempt_practice.refresh import (
    refresh_attempt_practice,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.practice.create import create_practice
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
        practice=True,
    )
    practice = await create_practice(
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
    return await create_attempt_practice(
        conn,
        attempt_id=attempt.id,
        practice_id=practice.id,
        session_id=session.id,
    )


async def test_appears_after_refresh(conn):
    result = await _setup(conn)
    await refresh_attempt_practice(conn)

    items = await get_attempt_practice(conn, attempt_ids=[result.attempt_id])
    assert len(items) >= 1


async def test_not_visible_before_refresh(conn):
    result = await _setup(conn)

    items = await get_attempt_practice(conn, attempt_ids=[result.attempt_id])
    assert len(items) == 0
