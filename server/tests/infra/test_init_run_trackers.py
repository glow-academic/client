"""Tests for infra.websocket.init_run_trackers — Redis tracker initialization.

Uses real Redis from testcontainers via redis_client fixture.
"""

import pytest

from app.infra.websocket.init_run_trackers import GENERATION_TTL, init_run_trackers


@pytest.mark.asyncio
class TestInitRunTrackers:
    async def test_sets_generation_and_resource_keys(self, redis_client):
        """Both generation and resource progress keys are set."""
        await init_run_trackers(
            redis_client, run_id="run-123", num_agents=3, num_resources=5
        )

        # Verify generation key
        gen = await redis_client.hgetall("generation:run-123")
        assert gen[b"expected"] == b"3"
        assert gen[b"completed"] == b"0"
        assert gen[b"tool_results"] == b"[]"

        # Verify resource progress key
        res = await redis_client.hgetall("resource_progress:run-123")
        assert res[b"total"] == b"5"
        assert res[b"completed"] == b"0"

        # Verify TTL is set (should be close to GENERATION_TTL)
        gen_ttl = await redis_client.ttl("generation:run-123")
        assert gen_ttl > 0 and gen_ttl <= GENERATION_TTL

        res_ttl = await redis_client.ttl("resource_progress:run-123")
        assert res_ttl > 0 and res_ttl <= GENERATION_TTL

    async def test_none_redis_skips_silently(self):
        """When redis is None, does nothing (no error)."""
        await init_run_trackers(
            None, run_id="run-456", num_agents=1, num_resources=2
        )

    async def test_single_agent_single_resource(self, redis_client):
        """Minimal case: 1 agent, 1 resource."""
        await init_run_trackers(
            redis_client, run_id="run-min", num_agents=1, num_resources=1
        )

        gen = await redis_client.hgetall("generation:run-min")
        assert gen[b"expected"] == b"1"

        res = await redis_client.hgetall("resource_progress:run-min")
        assert res[b"total"] == b"1"

    async def test_overwrites_existing_keys(self, redis_client):
        """Calling twice overwrites previous values."""
        await init_run_trackers(
            redis_client, run_id="run-ow", num_agents=2, num_resources=3
        )
        await init_run_trackers(
            redis_client, run_id="run-ow", num_agents=5, num_resources=10
        )

        gen = await redis_client.hgetall("generation:run-ow")
        assert gen[b"expected"] == b"5"

        res = await redis_client.hgetall("resource_progress:run-ow")
        assert res[b"total"] == b"10"
