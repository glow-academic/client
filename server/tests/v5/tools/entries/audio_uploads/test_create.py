"""Tests for create_audio_upload."""

import pytest

from app.routes.v5.tools.entries.audio_uploads.create import create_audio_upload
from app.routes.v5.tools.entries.audio_uploads.get import get_audio_upload
from app.routes.v5.tools.entries.audios.create import create_audio
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _deps(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    audio = await create_audio(conn, session_id=session.id)
    upload = await create_upload(
        conn, session_id=session.id, file_path="test/audio.mp3", mime_type="audio/mpeg", size=2048,
    )
    return session, audio, upload


async def test_creates_audio_upload_entry(conn):
    session, audio, upload = await _deps(conn)
    result = await create_audio_upload(conn, audio_id=audio.id, upload_id=upload.id, session_id=session.id)

    assert result.id is not None


async def test_audio_upload_exists_in_table(conn):
    session, audio, upload = await _deps(conn)
    result = await create_audio_upload(conn, audio_id=audio.id, upload_id=upload.id, session_id=session.id)

    row = await get_audio_upload(conn, result.id)

    assert row is not None
    assert row.audio_id == audio.id
    assert row.upload_id == upload.id
    assert row.session_id == session.id
    assert row.active is True


async def test_passes_mcp_flag(conn):
    session, audio, upload = await _deps(conn)
    result = await create_audio_upload(conn, audio_id=audio.id, upload_id=upload.id, session_id=session.id, mcp=True)

    row = await get_audio_upload(conn, result.id)

    assert row is not None
    assert row.mcp is True
