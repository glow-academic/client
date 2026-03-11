"""End-to-end tests for implemented test HTTP workflow routes."""

from __future__ import annotations

from uuid import UUID

import pytest
import pytest_asyncio
from app.routes.v5.tools.entries.benchmark.create import create_benchmark

from tests.infra.route_helpers import create_admin_route_actor


@pytest_asyncio.fixture
async def test_route_actor(pool, redis_client, setting_graph_factory):
    return await create_admin_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
        tool_artifacts=["test", "benchmark"],
        group_name="test-route",
        role_name_prefix="Test Route Admin",
    )


@pytest.mark.asyncio
class TestTestWorkflowRoutes:
    async def _create_test_run_graph(self, pool, actor):
        from app.routes.v5.tools.entries.calls.create import create_call
        from app.routes.v5.tools.entries.groups.create import create_group
        from app.routes.v5.tools.entries.messages.create import create_message
        from app.routes.v5.tools.entries.runs.create import create_run
        from app.routes.v5.tools.entries.test.create import create_test
        from app.routes.v5.tools.entries.test.refresh import refresh_test
        from app.routes.v5.tools.entries.test_invocation.create import (
            create_test_invocation,
        )
        from app.routes.v5.tools.entries.test_invocation.refresh import (
            refresh_test_invocation,
        )
        from app.routes.v5.tools.entries.test_invocation_runs.create import (
            create_test_invocation_runs,
        )
        from app.routes.v5.tools.entries.test_invocation_runs.refresh import (
            refresh_test_invocation_runs,
        )

        async with pool.acquire() as conn:
            source_group = await create_group(
                conn,
                session_id=actor.session_id,
                name="test-route-source",
            )
            source_run = await create_run(
                conn,
                group_id=source_group.id,
                session_id=actor.session_id,
                profiles_id=actor.profiles_id,
            )
            await create_message(conn, run_id=source_run.id, role="user")
            await create_message(conn, run_id=source_run.id, role="assistant")

            test_group = await create_group(
                conn,
                session_id=actor.session_id,
                name="test-route-invocation",
            )
            test_run = await create_run(
                conn,
                group_id=test_group.id,
                session_id=actor.session_id,
                profiles_id=actor.profiles_id,
            )
            await create_message(conn, run_id=test_run.id, role="user")
            await create_message(conn, run_id=test_run.id, role="assistant")
            test_call = await create_call(
                conn,
                run_id=test_run.id,
                session_id=actor.session_id,
            )
            test = await create_test(
                conn,
                call_id=test_call.id,
                profiles_id=actor.profiles_id,
                infinite_mode=False,
                is_dynamic=True,
            )
            invocation_call = await create_call(
                conn,
                run_id=test_run.id,
                session_id=actor.session_id,
            )
            invocation = await create_test_invocation(
                conn,
                test_id=test.id,
                call_id=invocation_call.id,
                group_id=source_group.id,
                use_custom=False,
            )
            await refresh_test(conn)
            await refresh_test_invocation(conn)
            await create_test_invocation_runs(
                conn,
                test_invocation_id=invocation.id,
            )
            await refresh_test_invocation_runs(conn)

        return {
            "test_id": str(test.id),
            "test_invocation_id": str(invocation.id),
            "run_id": str(source_run.id),
        }

    async def test_start_test_route_uses_real_http_stack(
        self,
        pool,
        v5_test_route_client,
        test_route_actor,
    ):
        async with pool.acquire() as conn:
            benchmark = await create_benchmark(
                conn,
                session_id=test_route_actor.session_id,
                profiles_ids=[test_route_actor.profiles_id],
                departments_ids=[test_route_actor.department_id],
            )

        v5_test_route_client.authenticate(
            profile_id=test_route_actor.profile_id,
            session_id=test_route_actor.session_id,
        )
        response = await v5_test_route_client.client.post(
            "/api/v5/artifacts/test/start",
            json={"benchmark_id": str(benchmark.id), "infinite_mode": False},
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["test_id"]

    async def test_run_test_route_uses_real_http_stack(
        self,
        pool,
        v5_test_route_client,
        test_route_actor,
    ):
        graph = await self._create_test_run_graph(pool, test_route_actor)

        v5_test_route_client.authenticate(
            profile_id=test_route_actor.profile_id,
            session_id=test_route_actor.session_id,
        )
        response = await v5_test_route_client.client.post(
            "/api/v5/artifacts/test/run",
            json={
                "test_id": graph["test_id"],
                "test_invocation_id": graph["test_invocation_id"],
                "run_id": graph["run_id"],
            },
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["test_id"] == graph["test_id"]
        assert payload["invocation_id"] == graph["test_invocation_id"]
        assert payload["run_id"]

        async with pool.acquire() as conn:
            stored_run_id = await conn.fetchval(
                "SELECT id FROM runs_entry WHERE id = $1",
                UUID(payload["run_id"]),
            )

        assert stored_run_id == UUID(payload["run_id"])

    async def test_next_test_route_uses_real_http_stack(
        self,
        pool,
        v5_test_route_client,
        test_route_actor,
    ):
        graph = await self._create_test_run_graph(pool, test_route_actor)

        v5_test_route_client.authenticate(
            profile_id=test_route_actor.profile_id,
            session_id=test_route_actor.session_id,
        )
        response = await v5_test_route_client.client.post(
            "/api/v5/artifacts/test/next",
            json={"test_id": graph["test_id"]},
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["invocation_id"] == graph["test_invocation_id"]
        assert payload["run_id"]
        assert payload["current_run"] == 1
        assert payload["total_runs"] == 1

        async with pool.acquire() as conn:
            stored_run_id = await conn.fetchval(
                "SELECT id FROM runs_entry WHERE id = $1",
                UUID(payload["run_id"]),
            )

        assert stored_run_id == UUID(payload["run_id"])

    async def test_end_test_route_creates_grade_via_real_http_stack(
        self,
        pool,
        v5_test_route_client,
        test_route_actor,
    ):
        graph = await self._create_test_run_graph(pool, test_route_actor)

        v5_test_route_client.authenticate(
            profile_id=test_route_actor.profile_id,
            session_id=test_route_actor.session_id,
        )
        response = await v5_test_route_client.client.post(
            "/api/v5/artifacts/test/end",
            json={
                "test_id": graph["test_id"],
                "test_invocation_id": graph["test_invocation_id"],
                "run_id": graph["run_id"],
                "grade": True,
            },
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["invocation_id"] == graph["test_invocation_id"]
        assert payload["grade_id"]

        async with pool.acquire() as conn:
            stored_grade_id = await conn.fetchval(
                "SELECT id FROM test_grade_entry WHERE id = $1",
                UUID(payload["grade_id"]),
            )

        assert stored_grade_id == UUID(payload["grade_id"])

    async def test_stop_test_route_uses_real_http_stack(
        self,
        pool,
        v5_test_route_client,
        test_route_actor,
    ):
        graph = await self._create_test_run_graph(pool, test_route_actor)

        v5_test_route_client.authenticate(
            profile_id=test_route_actor.profile_id,
            session_id=test_route_actor.session_id,
        )
        response = await v5_test_route_client.client.post(
            "/api/v5/artifacts/test/stop",
            json={"invocation_id": graph["test_invocation_id"]},
        )

        assert response.status_code == 200, response.text
        assert response.json() == {
            "invocation_id": graph["test_invocation_id"],
            "success": True,
            "message": "Test execution stopped",
        }
