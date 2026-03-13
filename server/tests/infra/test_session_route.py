"""End-to-end tests for implemented session HTTP routes."""

from __future__ import annotations

from uuid import UUID

import pytest
import pytest_asyncio
from tests.infra.route_helpers import create_admin_route_actor


@pytest_asyncio.fixture
async def session_route_actor(pool, redis_client, setting_graph_factory):
    return await create_admin_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
        tool_artifacts=["session"],
        group_name="session-route",
        role_name_prefix="Session Route Admin",
    )


async def _create_session_route_graph(pool, actor):
    from app.tools.v5.entries.calls.create import create_call
    from app.tools.v5.entries.chat.create import create_chat
    from app.tools.v5.entries.chat.refresh import refresh_chat
    from app.tools.v5.entries.groups.create import create_group
    from app.tools.v5.entries.groups.refresh import refresh_groups
    from app.tools.v5.entries.logins.create import create_login
    from app.tools.v5.entries.logins.refresh import refresh_logins
    from app.tools.v5.entries.problems.create import create_problem
    from app.tools.v5.entries.problems.refresh import refresh_problems
    from app.tools.v5.entries.runs.create import create_run

    async with pool.acquire() as conn:
        group = await create_group(
            conn,
            session_id=actor.session_id,
            name="session-route-group",
        )
        run = await create_run(
            conn,
            group_id=group.id,
            session_id=actor.session_id,
            profiles_id=actor.profiles_id,
        )
        call = await create_call(
            conn,
            run_id=run.id,
            session_id=actor.session_id,
        )
        await create_login(
            conn,
            session_id=actor.session_id,
            profile_id=actor.profiles_id,
        )
        await create_problem(
            conn,
            session_id=actor.session_id,
            call_id=call.id,
            type="bug",
            message="Session route problem",
            profile_id=actor.profiles_id,
        )
        await create_chat(
            conn,
            session_id=actor.session_id,
            department_ids=[actor.department_id],
            text_enabled=True,
            name="Session Route Chat",
        )
        await refresh_groups(conn)
        await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY runs_mv")
        await refresh_logins(conn)
        await refresh_problems(conn)
        await refresh_chat(conn)

    return {
        "session_id": str(actor.session_id),
        "group_id": str(group.id),
        "run_id": str(run.id),
    }


@pytest.mark.asyncio
class TestSessionRoute:
    async def test_get_session_route_returns_session_bundle(
        self,
        pool,
        v5_session_route_client,
        session_route_actor,
    ):
        graph = await _create_session_route_graph(pool, session_route_actor)
        v5_session_route_client.authenticate(
            profile_id=session_route_actor.profile_id,
            session_id=session_route_actor.session_id,
        )

        response = await v5_session_route_client.client.post(
            "/v5/session/get",
            json={"session_id": graph["session_id"]},
            headers={"X-Bypass-Cache": "1"},
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Cache-Tags"] == "artifacts,session"

        payload = response.json()
        assert payload["session_exists"] is True
        assert payload["session_id"] == graph["session_id"]
        assert payload["profile_id"] == str(session_route_actor.profiles_id)
        assert payload["groups"]
        assert payload["groups"][0]["group_id"] == graph["group_id"]
        assert payload["groups"][0]["run_count"] >= 1
        assert payload["timeline"]

        async with pool.acquire() as conn:
            stored_session_id = await conn.fetchval(
                "SELECT id FROM sessions_entry WHERE id = $1",
                UUID(graph["session_id"]),
            )

        assert stored_session_id == UUID(graph["session_id"])
