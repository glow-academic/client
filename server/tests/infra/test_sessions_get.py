"""Behavioral tests for app.infra.sessions.get."""

from __future__ import annotations

from uuid import UUID

import pytest
import pytest_asyncio
from tests.infra.route_helpers import create_admin_route_actor

from app.infra.sessions.get import get_session_impl
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.sessions.refresh import refresh_sessions


@pytest_asyncio.fixture
async def sessions_get_actor(pool, redis_client, setting_graph_factory):
    return await create_admin_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
        tool_artifacts=["session"],
        group_name="sessions-get",
        role_name_prefix="Sessions Get Admin",
    )


@pytest.mark.asyncio
class TestGetSessionImpl:
    async def test_returns_most_recent_active_session_for_profile(
        self,
        pool,
        redis_client,
        sessions_get_actor,
    ):
        async with pool.acquire() as conn:
            newer_session = await create_session(
                conn,
                profile_id=sessions_get_actor.profiles_id,
            )
            await refresh_sessions(conn)

            resolved = await get_session_impl(
                conn,
                sessions_get_actor.profiles_id,
                redis=redis_client,
                bypass_cache=True,
            )

        assert resolved == newer_session.id

    async def test_uses_cached_session_result(
        self,
        pool,
        redis_client,
        sessions_get_actor,
    ):
        async with pool.acquire() as conn:
            newer_session = await create_session(
                conn,
                profile_id=sessions_get_actor.profiles_id,
            )
            await refresh_sessions(conn)
            first = await get_session_impl(
                conn,
                sessions_get_actor.profiles_id,
                redis=redis_client,
                bypass_cache=False,
            )

            newest_session = await create_session(
                conn,
                profile_id=sessions_get_actor.profiles_id,
            )
            await refresh_sessions(conn)
            cached = await get_session_impl(
                conn,
                sessions_get_actor.profiles_id,
                redis=redis_client,
                bypass_cache=False,
            )
            refreshed = await get_session_impl(
                conn,
                sessions_get_actor.profiles_id,
                redis=redis_client,
                bypass_cache=True,
            )

        assert first == newer_session.id
        assert cached == newer_session.id
        assert refreshed == newest_session.id
        assert isinstance(refreshed, UUID)
