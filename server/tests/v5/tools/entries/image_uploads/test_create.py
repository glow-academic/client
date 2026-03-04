"""Tests for create_image_upload."""

import pytest

from app.routes.v5.tools.entries.image_uploads.create import create_image_upload
from app.routes.v5.tools.entries.image_uploads.get import get_image_upload
from app.routes.v5.tools.entries.images.create import create_image
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def _deps(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    image = await create_image(conn, session_id=session.id)
    upload = await create_upload(
        conn,
        session_id=session.id,
        file_path="test/photo.jpg",
        mime_type="image/jpeg",
        size=4096,
    )
    return session, image, upload


async def test_creates_image_upload_entry(conn):
    session, image, upload = await _deps(conn)
    result = await create_image_upload(
        conn, image_id=image.id, upload_id=upload.id, session_id=session.id
    )

    assert result.id is not None


async def test_image_upload_exists_in_table(conn):
    session, image, upload = await _deps(conn)
    result = await create_image_upload(
        conn, image_id=image.id, upload_id=upload.id, session_id=session.id
    )

    row = await get_image_upload(conn, result.id)

    assert row is not None
    assert row.image_id == image.id
    assert row.upload_id == upload.id
    assert row.session_id == session.id
    assert row.active is True


async def test_passes_mcp_flag(conn):
    session, image, upload = await _deps(conn)
    result = await create_image_upload(
        conn, image_id=image.id, upload_id=upload.id, session_id=session.id, mcp=True
    )

    row = await get_image_upload(conn, result.id)

    assert row is not None
    assert row.mcp is True
