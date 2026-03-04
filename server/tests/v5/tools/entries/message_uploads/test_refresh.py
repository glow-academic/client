"""Tests for refresh_message_uploads."""

import pytest

from app.routes.v5.tools.entries.message_uploads.create import create_message_upload
from app.routes.v5.tools.entries.message_uploads.refresh import refresh_message_uploads
from app.routes.v5.tools.entries.messages.create import create_message
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.uploads.create import create_upload
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _setup(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    parent = await create_message(conn, session_id=session.id)
    upload = await create_upload(
        conn, session_id=session.id, file_path="test/file.bin", mime_type="application/octet-stream", size=1024
    )
    return session, parent, upload


async def test_new_upload_appears_in_mv_after_refresh(conn):
    session, parent, upload = await _setup(conn)
    result = await create_message_upload(
        conn, message_id=parent.id, upload_id=upload.id, session_id=session.id
    )

    row = await conn.fetchrow("SELECT id FROM message_uploads_mv WHERE id = $1", result.id)
    assert row is None

    await refresh_message_uploads(conn)

    row = await conn.fetchrow("SELECT id FROM message_uploads_mv WHERE id = $1", result.id)
    assert row is not None
    assert row["id"] == result.id
