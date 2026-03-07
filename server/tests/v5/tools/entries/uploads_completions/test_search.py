"""Tests for search_uploads_completions."""

import pytest
from tests.helpers import nonexistent_id

from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.routes.v5.tools.entries.uploads_completions.create import (
    create_upload_completion,
)
from app.routes.v5.tools.entries.uploads_completions.search import (
    search_uploads_completions,
)

pytestmark = pytest.mark.asyncio


async def _setup(conn, profile_id):
    session = await create_session(conn, profile_id=profile_id)
    upload = await create_upload(
        conn,
        session_id=session.id,
        file_path="test/file.txt",
        mime_type="text/plain",
        size=1024,
    )
    completion = await create_upload_completion(
        conn,
        upload_id=upload.id,
        session_id=session.id,
    )
    return completion, upload


async def test_finds_created_entry(conn, profile_id):
    completion, upload = await _setup(conn, profile_id)
    await conn.execute("REFRESH MATERIALIZED VIEW uploads_completions_mv")

    items = await search_uploads_completions(conn, upload_ids=[upload.id])

    ids = [item.id for item in items]
    assert completion.id in ids


async def test_filters_by_upload_id(conn, profile_id):
    await _setup(conn, profile_id)
    await conn.execute("REFRESH MATERIALIZED VIEW uploads_completions_mv")

    items = await search_uploads_completions(conn, upload_ids=[nonexistent_id()])

    assert items == []


async def test_pagination_limit(conn, profile_id):
    completion, upload = await _setup(conn, profile_id)
    await conn.execute("REFRESH MATERIALIZED VIEW uploads_completions_mv")

    items = await search_uploads_completions(conn, upload_ids=[upload.id], limit=1)

    assert len(items) <= 1


async def test_returns_all_without_filter(conn, profile_id):
    await _setup(conn, profile_id)
    await conn.execute("REFRESH MATERIALIZED VIEW uploads_completions_mv")

    items = await search_uploads_completions(conn)

    assert len(items) >= 1


async def test_bypass_mv_finds_without_refresh(conn, profile_id):
    completion, upload = await _setup(conn, profile_id)

    items = await search_uploads_completions(
        conn, upload_ids=[upload.id], bypass_mv=True
    )

    ids = [item.id for item in items]
    assert completion.id in ids
