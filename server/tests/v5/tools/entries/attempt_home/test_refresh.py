"""Tests for refresh_attempt_home."""

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt_home.create import create_attempt_home
from app.routes.v5.tools.entries.attempt_home.refresh import refresh_attempt_home
from app.routes.v5.tools.entries.attempt_home.search import (
    search_attempt_home_entries_internal,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.home.create import create_home
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_new_attempt_home_appears_after_refresh(conn):
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
    home = await create_home(conn, session_id=session.id)
    result = await create_attempt_home(
        conn,
        attempt_id=attempt.id,
        home_id=home.id,
        session_id=session.id,
    )

    await refresh_attempt_home(conn)

    items = await search_attempt_home_entries_internal(conn, attempt_id=attempt.id)
    assert len(items) == 1
    assert items[0]["attempt_id"] == result.attempt_id
    assert items[0]["home_id"] == result.home_id


async def test_new_attempt_home_not_visible_before_refresh(conn):
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
    home = await create_home(conn, session_id=session.id)
    result = await create_attempt_home(
        conn,
        attempt_id=attempt.id,
        home_id=home.id,
        session_id=session.id,
    )

    items = await search_attempt_home_entries_internal(conn, attempt_id=attempt.id)
    assert items == []
