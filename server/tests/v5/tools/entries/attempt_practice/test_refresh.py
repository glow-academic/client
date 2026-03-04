"""Tests for refresh_attempt_practice."""

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt_practice.create import create_attempt_practice
from app.routes.v5.tools.entries.attempt_practice.refresh import (
    refresh_attempt_practice,
)
from app.routes.v5.tools.entries.attempt_practice.search import (
    search_attempt_practice_entries_internal,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.practice.create import create_practice
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_new_attempt_practice_appears_after_refresh(conn):
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
    practice = await create_practice(conn, session_id=session.id)
    result = await create_attempt_practice(
        conn,
        attempt_id=attempt.id,
        practice_id=practice.id,
        session_id=session.id,
    )

    await refresh_attempt_practice(conn)

    items = await search_attempt_practice_entries_internal(conn, attempt_id=attempt.id)
    assert len(items) == 1
    assert items[0]["attempt_id"] == result.attempt_id
    assert items[0]["practice_id"] == result.practice_id


async def test_new_attempt_practice_not_visible_before_refresh(conn):
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
    practice = await create_practice(conn, session_id=session.id)
    result = await create_attempt_practice(
        conn,
        attempt_id=attempt.id,
        practice_id=practice.id,
        session_id=session.id,
    )

    items = await search_attempt_practice_entries_internal(conn, attempt_id=attempt.id)
    assert items == []
