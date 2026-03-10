"""End-to-end tests for the canonical agent HTTP routes."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import pytest
import pytest_asyncio

from tests.helpers import unique_tag
from tests.infra.route_helpers import RouteActor, create_admin_route_actor


@dataclass(frozen=True)
class AgentRouteResources:
    name_id: UUID
    name: str
    description_id: UUID
    description: str
    model_id: UUID
    model_name: str
    model_value: str
    tool_id: UUID
    tool_name: str


async def _create_agent_route_resources(pool, redis_client) -> AgentRouteResources:
    from app.routes.v5.tools.resources.descriptions.create import create_description
    from app.routes.v5.tools.resources.models.create import create_model
    from app.routes.v5.tools.resources.names.create import create_name
    from app.routes.v5.tools.resources.tools.create import create_tool

    tag = unique_tag()
    name = f"Route Agent {tag}"
    description = f"Route agent description {tag}"
    model_name = f"Route Model {tag}"
    model_value = f"route-model-{tag}"
    tool_name = f"route-tool-{tag}"

    async with pool.acquire() as conn:
        name_res = await create_name(conn, name, redis_client)
        description_res = await create_description(conn, description, redis_client)
        model_res = await create_model(
            conn,
            value=model_value,
            name=model_name,
            description=f"Model for {tag}",
            redis=redis_client,
        )
        tool_res = await create_tool(
            conn,
            name=tool_name,
            description=f"Tool for {tag}",
            redis=redis_client,
        )

    return AgentRouteResources(
        name_id=name_res.id,
        name=name_res.name,
        description_id=description_res.id,
        description=description_res.description,
        model_id=model_res.id,
        model_name=model_res.name or "",
        model_value=model_res.value,
        tool_id=tool_res.id,
        tool_name=tool_res.name,
    )


@pytest_asyncio.fixture
async def agent_route_actor(pool, redis_client, setting_graph_factory):
    return await create_admin_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
        tool_artifacts=["agent", "scenario", "persona"],
        group_name="agent-route",
        role_name_prefix="Agent Route Admin",
    )


@pytest.mark.asyncio
class TestAgentRoute:
    async def test_create_agent_route_uses_real_http_stack(
        self,
        pool,
        redis_client,
        v5_agent_route_client,
        agent_route_actor,
    ):
        resources = await _create_agent_route_resources(pool, redis_client)
        v5_agent_route_client.authenticate(
            profile_id=agent_route_actor.profile_id,
            session_id=agent_route_actor.session_id,
        )

        response = await v5_agent_route_client.client.post(
            "/api/v5/artifacts/agents/create",
            json={
                "agents": [
                    {
                        "name_id": str(resources.name_id),
                        "description_id": str(resources.description_id),
                        "department_ids": [str(agent_route_actor.department_id)],
                        "model_ids": [str(resources.model_id)],
                        "tool_ids": [str(resources.tool_id)],
                    }
                ]
            },
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Invalidate-Tags"] == "agents"

        payload = response.json()
        assert payload["results"][0]["success"] is True
        assert payload["results"][0]["message"] == "Agent created successfully"
        assert payload["results"][0]["agent_id"] is not None

    async def test_get_agent_route_returns_canonical_bundle(
        self,
        pool,
        redis_client,
        v5_agent_route_client,
        agent_route_actor,
    ):
        created = await self._create_agent_via_route(
            pool,
            redis_client,
            v5_agent_route_client,
            agent_route_actor,
        )

        response = await v5_agent_route_client.client.post(
            "/api/v5/artifacts/agents/get",
            json={"agent_id": created["agent_id"]},
            headers={"X-Bypass-Cache": "1"},
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Cache-Tags"] == "agents"
        assert response.headers["X-Cache-Hit"] == "0"

        payload = response.json()
        assert payload["actor_name"] == agent_route_actor.name
        assert payload["agent_exists"] is True
        assert payload["can_edit"] is False
        assert payload["disabled_reason"]
        assert payload["group_id"] is not None
        assert payload["names"]["resource"]["name"] == created["name"]
        assert payload["descriptions"]["resource"]["description"] == created["description"]
        assert payload["models"]["resource"]["id"] == created["model_id"]
        assert payload["models"]["resource"]["name"] == created["model_name"]

    async def test_search_agent_route_returns_created_agent(
        self,
        pool,
        redis_client,
        v5_agent_route_client,
        agent_route_actor,
    ):
        created = await self._create_agent_via_route(
            pool,
            redis_client,
            v5_agent_route_client,
            agent_route_actor,
        )

        response = await v5_agent_route_client.client.post(
            "/api/v5/artifacts/agents/search",
            json={
                "search": created["name"],
                "filter_department_ids": [str(agent_route_actor.department_id)],
                "page_size": 10,
                "page_offset": 0,
            },
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Invalidate-Tags"] == "agents"

        payload = response.json()
        assert payload["actor_name"] == agent_route_actor.name
        assert payload["total_count"] >= 1
        assert any(agent["agent_id"] == created["agent_id"] for agent in payload["agents"])

        created_agent = next(
            agent for agent in payload["agents"] if agent["agent_id"] == created["agent_id"]
        )
        assert created_agent["name"] == created["name"]
        assert created_agent["model_id"] == created["model_id"]
        assert created_agent["model_name"] == created["model_name"]
        assert created_agent["department_ids"] == [str(agent_route_actor.department_id)]
        assert created_agent["can_edit"] is True
        assert created_agent["can_duplicate"] is True
        assert created_agent["can_delete"] is True

    async def _create_agent_via_route(
        self,
        pool,
        redis_client,
        v5_agent_route_client,
        agent_route_actor: RouteActor,
    ) -> dict[str, str]:
        resources = await _create_agent_route_resources(pool, redis_client)
        v5_agent_route_client.authenticate(
            profile_id=agent_route_actor.profile_id,
            session_id=agent_route_actor.session_id,
        )

        response = await v5_agent_route_client.client.post(
            "/api/v5/artifacts/agents/create",
            json={
                "agents": [
                    {
                        "name_id": str(resources.name_id),
                        "description_id": str(resources.description_id),
                        "department_ids": [str(agent_route_actor.department_id)],
                        "model_ids": [str(resources.model_id)],
                        "tool_ids": [str(resources.tool_id)],
                    }
                ]
            },
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        return {
            "agent_id": payload["results"][0]["agent_id"],
            "name": resources.name,
            "description": resources.description,
            "model_id": str(resources.model_id),
            "model_name": resources.model_name,
        }
