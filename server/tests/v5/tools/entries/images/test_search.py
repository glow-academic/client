"""Tests for search_images."""

import pytest

from app.routes.v5.tools.entries.images.create import create_image
from app.routes.v5.tools.entries.images.search import search_images
from app.routes.v5.tools.entries.image_uploads.create import create_image_upload
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.uploads.create import create_upload
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    image = await create_image(conn, session_id=session.id)
    upload = await create_upload(
        conn,
        session_id=session.id,
        file_path="/test/image.png",
        mime_type="image/png",
        size=2048,
    )
    files_id = await conn.fetchval(
        "INSERT INTO files_resource (active, mcp, generated) VALUES (true, false, true) RETURNING id"
    )
    await conn.execute(
        "INSERT INTO files_uploads_connection (upload_id, files_id, active) VALUES ($1, $2, true)",
        upload.id,
        files_id,
    )
    await create_image_upload(
        conn, image_id=image.id, upload_id=upload.id, session_id=session.id
    )
    return image, files_id


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_images(conn, bypass_mv=True)

    assert len(items) >= 1


async def test_filters_by_files_id(conn, profile_id):
    _, files_id = await _setup(conn, profile_id)

    items = await search_images(conn, files_id=files_id, bypass_mv=True)

    assert len(items) >= 1
    assert all(item.files_id == files_id for item in items)


async def test_filters_by_nonexistent_files_id(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_images(conn, files_id=nonexistent_id(), bypass_mv=True)

    assert items == []


async def test_pagination_limit(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_images(conn, limit=1, bypass_mv=True)

    assert len(items) <= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    image, files_id = await _setup(conn, profile_id)

    items = await search_images(conn, files_id=files_id, bypass_mv=True)

    image_ids = [item.image_id for item in items]
    assert image.id in image_ids
