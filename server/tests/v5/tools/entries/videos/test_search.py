"""Tests for search_videos."""

import pytest

from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.entries.video_uploads.create import create_video_upload
from app.routes.v5.tools.entries.videos.create import create_video
from app.routes.v5.tools.entries.videos.search import search_videos
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    video = await create_video(conn, session_id=session.id, length_seconds=120)
    upload = await create_upload(
        conn,
        session_id=session.id,
        file_path="test/video.mp4",
        mime_type="video/mp4",
        size=2048,
    )
    await create_video_upload(
        conn, video_id=video.id, upload_id=upload.id, session_id=session.id
    )
    # videos_mv requires: files_resource + files_uploads_connection
    files_id = await conn.fetchval(
        "INSERT INTO files_resource DEFAULT VALUES RETURNING id"
    )
    await conn.execute(
        "INSERT INTO files_uploads_connection (files_id, upload_id) VALUES ($1, $2)",
        files_id,
        upload.id,
    )
    return video, files_id


async def test_finds_created_entry(conn, profile_id):
    video, files_id = await _setup(conn, profile_id)
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY videos_mv")

    items = await search_videos(conn, files_id=files_id)

    ids = [item.video_id for item in items]
    assert video.id in ids


async def test_filters_by_files_id(conn, profile_id):
    await _setup(conn, profile_id)
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY videos_mv")

    items = await search_videos(conn, files_id=nonexistent_id())

    assert items == []


async def test_pagination_limit(conn, profile_id):
    video, files_id = await _setup(conn, profile_id)
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY videos_mv")

    items = await search_videos(conn, files_id=files_id, limit=1)

    assert len(items) <= 1


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY videos_mv")

    items = await search_videos(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    video, files_id = await _setup(conn, profile_id)

    items = await search_videos(conn, files_id=files_id, bypass_mv=True)

    ids = [item.video_id for item in items]
    assert video.id in ids
