"""Tests for search_files."""

import pytest

from app.routes.v5.tools.entries.files.create import create_file
from app.routes.v5.tools.entries.files.search import search_files
from app.routes.v5.tools.entries.file_uploads.create import create_file_upload
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.uploads.create import create_upload
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    file = await create_file(conn, session_id=session.id)
    upload = await create_upload(
        conn,
        session_id=session.id,
        file_path="/test/document.pdf",
        mime_type="application/pdf",
        size=4096,
    )
    files_id = await conn.fetchval(
        "INSERT INTO files_resource (active, mcp, generated) VALUES (true, false, true) RETURNING id"
    )
    await conn.execute(
        "INSERT INTO files_uploads_connection (upload_id, files_id, active) VALUES ($1, $2, true)",
        upload.id,
        files_id,
    )
    await create_file_upload(
        conn, file_id=file.id, upload_id=upload.id, session_id=session.id
    )
    return file, files_id


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_files(conn, bypass_mv=True)

    assert len(items) >= 1


async def test_filters_by_files_id(conn, profile_id):
    _, files_id = await _setup(conn, profile_id)

    items = await search_files(conn, files_id=files_id, bypass_mv=True)

    assert len(items) >= 1
    assert all(item.files_id == files_id for item in items)


async def test_filters_by_mime_type(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_files(conn, mime_type="application/pdf", bypass_mv=True)

    assert len(items) >= 1
    assert all(item.mime_type == "application/pdf" for item in items)


async def test_filters_by_nonexistent_files_id(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_files(conn, files_id=nonexistent_id(), bypass_mv=True)

    assert items == []


async def test_pagination_limit(conn, profile_id):
    await _setup(conn, profile_id)

    items = await search_files(conn, limit=1, bypass_mv=True)

    assert len(items) <= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    file, files_id = await _setup(conn, profile_id)

    items = await search_files(conn, files_id=files_id, bypass_mv=True)

    file_ids = [item.file_id for item in items]
    assert file.id in file_ids
