"""Tests for create_file_upload."""

import pytest

from app.routes.v5.tools.entries.file_uploads.create import create_file_upload
from app.routes.v5.tools.entries.file_uploads.get import get_file_upload
from app.routes.v5.tools.entries.files.create import create_file
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _deps(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    file = await create_file(conn, session_id=session.id)
    upload = await create_upload(
        conn, session_id=session.id, file_path="test/doc.pdf", mime_type="application/pdf", size=3072,
    )
    return file, upload


async def test_creates_file_upload_entry(conn):
    file, upload = await _deps(conn)
    result = await create_file_upload(conn, file_id=file.id, upload_id=upload.id)

    assert result.id is not None


async def test_file_upload_exists_in_table(conn):
    file, upload = await _deps(conn)
    result = await create_file_upload(conn, file_id=file.id, upload_id=upload.id)

    row = await get_file_upload(conn, result.id)

    assert row is not None
    assert row.file_id == file.id
    assert row.upload_id == upload.id
    assert row.active is True


async def test_passes_mcp_flag(conn):
    file, upload = await _deps(conn)
    result = await create_file_upload(conn, file_id=file.id, upload_id=upload.id, mcp=True)

    row = await get_file_upload(conn, result.id)

    assert row is not None
    assert row.mcp is True
