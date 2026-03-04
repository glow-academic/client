"""Tests for create_home_chat."""

import pytest

from app.routes.v5.tools.entries.chat.create import create_chat
from app.routes.v5.tools.entries.home.create import create_home
from app.routes.v5.tools.entries.home_chat.create import create_home_chat
from app.routes.v5.tools.entries.home_chat.get import get_home_chats
from app.routes.v5.tools.entries.home_chat.refresh import refresh_home_chat
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


async def _home_chat(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
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
    chat = await create_chat(conn, session_id=session.id)
    home_chat = await create_home_chat(
        conn,
        home_id=home.id,
        chat_id=chat.id,
        session_id=session.id,
    )
    return session, home, chat, home_chat


async def test_returns_id(conn):
    _, _, _, result = await _home_chat(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    _, _, _, result = await _home_chat(conn)
    await refresh_home_chat(conn)

    items = await get_home_chats(conn, [result.id])

    assert len(items) == 1
    assert items[0].id == result.id
    assert items[0].active is True


async def test_links_home_and_chat(conn):
    _, home, chat, result = await _home_chat(conn)
    await refresh_home_chat(conn)

    items = await get_home_chats(conn, [result.id])

    assert len(items) == 1
    assert items[0].home_id == home.id
    assert items[0].chat_id == chat.id


async def test_passes_mcp_flag(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
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
    chat = await create_chat(conn, session_id=session.id)
    result = await create_home_chat(
        conn,
        home_id=home.id,
        chat_id=chat.id,
        session_id=session.id,
        mcp=True,
    )

    row = await conn.fetchrow(
        "SELECT mcp FROM home_chat_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
