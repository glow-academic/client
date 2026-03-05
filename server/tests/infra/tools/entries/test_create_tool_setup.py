"""Tests for create_tool_setup."""

import pytest

from app.infra.tools.entries.create_tool_setup import create_tool_setup
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.entries.runs.get import get_run
from app.routes.v5.tools.entries.calls.get import get_call
from app.routes.v5.tools.entries.messages.get import get_message
from app.routes.v5.tools.entries.texts.get import get_text
from app.routes.v5.tools.entries.text_uploads.get import get_text_upload
from app.routes.v5.tools.entries.call_uploads.get import get_call_upload
from app.routes.v5.tools.entries.message_uploads.get import get_message_upload
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID, USE_VOICES_TOOL_ID

pytestmark = pytest.mark.asyncio


# -- helpers -------------------------------------------------------------------


async def _deps(conn, *, with_call_upload: bool = True):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    group = await create_group(conn, session_id=session.id)
    text_upload = await create_upload(
        conn,
        session_id=session.id,
        file_path="test/file.txt",
        mime_type="text/plain",
        size=1024,
    )
    call_upload = None
    if with_call_upload:
        call_upload = await create_upload(
            conn,
            session_id=session.id,
            file_path="test/response.json",
            mime_type="application/json",
            size=512,
        )
    return session, group, text_upload, call_upload


async def _setup_with_tool(conn):
    session, group, text_upload, call_upload = await _deps(conn)
    result = await create_tool_setup(
        conn,
        group_id=group.id,
        session_id=session.id,
        text_upload_id=text_upload.id,
        profile_id=SUPERADMIN_PROFILES_RESOURCE_ID,
        tool_id=USE_VOICES_TOOL_ID,
        call_upload_id=call_upload.id,
    )
    return session, group, text_upload, call_upload, result


async def _setup_without_tool(conn):
    session, group, text_upload, _ = await _deps(conn, with_call_upload=False)
    result = await create_tool_setup(
        conn,
        group_id=group.id,
        session_id=session.id,
        text_upload_id=text_upload.id,
        profile_id=SUPERADMIN_PROFILES_RESOURCE_ID,
    )
    return session, group, text_upload, result


# -- with tool_id (full chain) ------------------------------------------------


async def test_returns_all_ids(conn):
    _, _, _, _, result = await _setup_with_tool(conn)

    assert result.run_id is not None
    assert result.call_id is not None
    assert result.message_id is not None
    assert result.text_id is not None
    assert result.text_upload_junction_id is not None
    assert result.call_upload_junction_id is not None
    assert result.message_text_upload_junction_id is not None
    assert result.message_call_upload_junction_id is not None


async def test_creates_run(conn):
    session, group, _, _, result = await _setup_with_tool(conn)

    run = await get_run(conn, result.run_id)

    assert run is not None
    assert run.group_id == group.id
    assert run.session_id == session.id


async def test_creates_call_with_tool(conn):
    session, _, _, _, result = await _setup_with_tool(conn)

    call = await get_call(conn, result.call_id)

    assert call is not None
    assert call.run_id == result.run_id
    assert call.session_id == session.id


async def test_creates_message(conn):
    _, _, _, _, result = await _setup_with_tool(conn)

    message = await get_message(conn, result.message_id)

    assert message is not None
    assert message.run_id == result.run_id
    assert message.role == "assistant"


async def test_creates_text(conn):
    session, _, _, _, result = await _setup_with_tool(conn)

    text = await get_text(conn, result.text_id)

    assert text is not None
    assert text.session_id == session.id


async def test_links_text_upload_to_text(conn):
    _, _, text_upload, _, result = await _setup_with_tool(conn)

    row = await get_text_upload(conn, result.text_upload_junction_id)

    assert row is not None
    assert row.text_id == result.text_id
    assert row.upload_id == text_upload.id


async def test_links_call_upload_to_call(conn):
    _, _, _, call_upload, result = await _setup_with_tool(conn)

    row = await get_call_upload(conn, result.call_upload_junction_id)

    assert row is not None
    assert row.call_id == result.call_id
    assert row.upload_id == call_upload.id


async def test_links_text_upload_to_message(conn):
    _, _, text_upload, _, result = await _setup_with_tool(conn)

    row = await get_message_upload(conn, result.message_text_upload_junction_id)

    assert row is not None
    assert row.message_id == result.message_id
    assert row.upload_id == text_upload.id


async def test_links_call_upload_to_message(conn):
    _, _, _, call_upload, result = await _setup_with_tool(conn)

    row = await get_message_upload(conn, result.message_call_upload_junction_id)

    assert row is not None
    assert row.message_id == result.message_id
    assert row.upload_id == call_upload.id


# -- without tool_id (text only) ----------------------------------------------


async def test_no_tool_returns_ids(conn):
    _, _, _, result = await _setup_without_tool(conn)

    assert result.run_id is not None
    assert result.call_id is None
    assert result.message_id is not None
    assert result.text_id is not None
    assert result.text_upload_junction_id is not None
    assert result.call_upload_junction_id is None
    assert result.message_text_upload_junction_id is not None
    assert result.message_call_upload_junction_id is None


async def test_no_tool_creates_run(conn):
    session, group, _, result = await _setup_without_tool(conn)

    run = await get_run(conn, result.run_id)

    assert run is not None
    assert run.group_id == group.id
    assert run.session_id == session.id


async def test_no_tool_creates_message(conn):
    _, _, _, result = await _setup_without_tool(conn)

    message = await get_message(conn, result.message_id)

    assert message is not None
    assert message.run_id == result.run_id


async def test_no_tool_creates_text(conn):
    session, _, _, result = await _setup_without_tool(conn)

    text = await get_text(conn, result.text_id)

    assert text is not None
    assert text.session_id == session.id


async def test_no_tool_links_text_upload_to_text(conn):
    _, _, text_upload, result = await _setup_without_tool(conn)

    row = await get_text_upload(conn, result.text_upload_junction_id)

    assert row is not None
    assert row.text_id == result.text_id
    assert row.upload_id == text_upload.id


async def test_no_tool_links_text_upload_to_message(conn):
    _, _, text_upload, result = await _setup_without_tool(conn)

    row = await get_message_upload(conn, result.message_text_upload_junction_id)

    assert row is not None
    assert row.message_id == result.message_id
    assert row.upload_id == text_upload.id
