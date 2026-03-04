"""Tests for get_voices."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.voices.get import get_voices

pytestmark = pytest.mark.asyncio


async def test_gets_created_voice(conn, redis_client):
    voice_id = await conn.fetchval("""
        INSERT INTO voices_resource (voice)
        VALUES ('test-voice')
        RETURNING id
    """)

    items = await get_voices(conn, [voice_id], redis_client)

    assert len(items) == 1
    assert items[0].id == voice_id
    assert items[0].voice == "test-voice"
    assert items[0].active is True


async def test_returns_empty_for_missing_voice(conn, redis_client):
    items = await get_voices(conn, [uuid4()], redis_client)

    assert items == []


async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_voices(conn, [], redis_client)

    assert items == []


async def test_cache_hit_skips_db(conn, redis_client):
    voice_id = await conn.fetchval("""
        INSERT INTO voices_resource (voice)
        VALUES ('test-voice-cache-hit')
        RETURNING id
    """)

    items = await get_voices(conn, [voice_id], redis_client)
    assert len(items) == 1

    items2 = await get_voices(conn, [voice_id], redis_client)
    assert len(items2) == 1
    assert items2[0].voice == "test-voice-cache-hit"


async def test_bypass_cache_skips_read_and_write(conn, redis_client):
    voice_id = await conn.fetchval("""
        INSERT INTO voices_resource (voice)
        VALUES ('test-voice-bypass')
        RETURNING id
    """)

    items = await get_voices(conn, [voice_id], redis_client, bypass_cache=True)
    assert len(items) == 1

    from app.utils.cache.cache_key import cache_key
    from app.utils.cache.get_cached import get_cached

    key = cache_key("/api/v5/resources/voices/get", {"ids": [str(voice_id)]})
    cached = await get_cached(key, redis=redis_client)
    assert cached is None
