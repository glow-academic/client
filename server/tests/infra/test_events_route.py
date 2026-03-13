"""Route tests for centralized SSE event streaming."""

from __future__ import annotations

import pytest
import pytest_asyncio
from tests.infra.route_helpers import create_admin_route_actor


@pytest_asyncio.fixture
async def events_route_actor(pool, redis_client, setting_graph_factory):
    return await create_admin_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
        tool_artifacts=["persona", "test", "session"],
        group_name="events-route",
        role_name_prefix="Events Route Admin",
    )


@pytest.mark.asyncio
class TestEventsRoutes:
    async def test_stream_requires_entity_id_for_entity_scoped_operations(
        self,
        v5_events_route_client,
        events_route_actor,
    ):
        v5_events_route_client.authenticate(
            profile_id=events_route_actor.profile_id,
            session_id=events_route_actor.session_id,
        )

        response = await v5_events_route_client.client.get(
            "/v5/stream",
            params={"artifact": "persona", "operation": "get"},
        )

        assert response.status_code == 400, response.text
        assert "entity_id is required" in response.json()["detail"]

    async def test_stream_requires_authentication(
        self,
        v5_events_route_client,
    ):
        response = await v5_events_route_client.client.get(
            "/v5/stream",
            params={"artifact": "persona", "operation": "search", "limit": 5},
        )

        assert response.status_code == 401, response.text
