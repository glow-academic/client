"""Tests for create_attempt_analysis."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt_chat.create import create_attempt_chat
from app.routes.v5.tools.entries.attempt_grade.create import create_attempt_grade
from app.routes.v5.tools.entries.attempt_analysis.create import create_attempt_analysis
from app.routes.v5.tools.entries.attempt_analysis.get import get_attempt_analyses
from app.routes.v5.tools.entries.attempt_analysis.refresh import refresh_attempt_analysis
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _attempt_analysis(conn, **overrides):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    run = await create_run(conn, group_id=group.id, session_id=session.id)
    call = await create_call(conn, run_id=run.id, session_id=session.id)
    await create_attempt(
        conn, call_id=call.id, profiles_id=SUPERADMIN_PROFILES_RESOURCE_ID
    )
    call2 = await create_call(conn, run_id=run.id, session_id=session.id)
    attempt_chat = await create_attempt_chat(
        conn, call_id=call2.id, group_id=group.id, chat_id=uuid4()
    )
    grade = await create_attempt_grade(
        conn,
        chat_id=attempt_chat.id,
        call_id=call2.id,
        run_id=run.id,
        time_taken=120,
        passed=True,
        score=85,
    )
    defaults = dict(grade_id=grade.id, call_id=call2.id, content="Test analysis")
    defaults.update(overrides)
    result = await create_attempt_analysis(conn, **defaults)
    return result


async def test_returns_id(conn):
    result = await _attempt_analysis(conn)
    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _attempt_analysis(conn)
    await refresh_attempt_analysis(conn)
    items = await get_attempt_analyses(conn, [result.id])
    assert len(items) == 1


async def test_passes_mcp_flag(conn):
    result = await _attempt_analysis(conn, mcp=True)
    row = await conn.fetchrow(
        "SELECT mcp FROM attempt_analysis_entry WHERE id = $1", result.id
    )
    assert row is not None
    assert row["mcp"] is True
