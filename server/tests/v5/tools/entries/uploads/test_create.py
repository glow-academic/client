"""Tests for create_upload."""

import pytest

from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.entries.uploads.get import get_upload
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _session(conn):
    return await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)


async def test_creates_upload_entry(conn):
    session = await _session(conn)
    result = await create_upload(
        conn, session_id=session.id, file_path="test/file.txt", mime_type="text/plain", size=1024,
    )

    assert result.id is not None


async def test_upload_exists_in_table(conn):
    session = await _session(conn)
    result = await create_upload(
        conn, session_id=session.id, file_path="test/file.txt", mime_type="text/plain", size=1024,
    )

    upload = await get_upload(conn, result.id)

    assert upload is not None
    assert upload.session_id == session.id
    assert upload.file_path == "test/file.txt"
    assert upload.mime_type == "text/plain"
    assert upload.size == 1024
    assert upload.active is True


async def test_passes_mcp_flag(conn):
    session = await _session(conn)
    result = await create_upload(
        conn, session_id=session.id, file_path="test/file.txt", mime_type="text/plain", size=512, mcp=True,
    )

    upload = await get_upload(conn, result.id)

    assert upload is not None
    assert upload.mcp is True
