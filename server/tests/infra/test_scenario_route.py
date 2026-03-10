"""End-to-end tests for the canonical scenario HTTP routes."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import pytest
import pytest_asyncio

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.helpers import unique_tag


@dataclass(frozen=True)
class ScenarioRouteActor:
    profile_id: UUID
    profiles_id: UUID
    session_id: UUID
    department_id: UUID
    name: str


@dataclass(frozen=True)
class ScenarioRouteResources:
    name_id: UUID
    name: str
    description_id: UUID
    description: str
    problem_statement_id: UUID
    problem_statement_name: str
    problem_statement: str


async def _create_scenario_route_actor(
    pool,
    redis_client,
    setting_graph_factory,
) -> ScenarioRouteActor:
    from app.routes.v5.tools.artifacts.profile.update import update_profile
    from app.routes.v5.tools.resources.roles.create import create_role

    graph = await setting_graph_factory(tool_artifacts=["scenario", "persona"])

    async with pool.acquire() as conn:
        admin_role = await create_role(
            conn,
            role="admin",
            name=f"Scenario Route Admin {unique_tag()}",
            description="Scenario route test admin role",
            redis=redis_client,
        )
        await update_profile(
            conn,
            graph.profile_artifact_id,
            role_ids=[admin_role.id],
            redis=redis_client,
        )
        session = await create_session(conn, profile_id=graph.profile_resource_id)
        await create_group(conn, session_id=session.id, name="scenario-route")

    identity = await resolve_profile_identity_context(
        pool,
        graph.profile_artifact_id,
        redis_client,
        session_id=session.id,
    )
    if identity is None:
        raise AssertionError("Expected route test actor identity to exist")

    return ScenarioRouteActor(
        profile_id=graph.profile_artifact_id,
        profiles_id=graph.profile_resource_id,
        session_id=session.id,
        department_id=graph.department_id,
        name=identity.name,
    )


async def _create_scenario_route_resources(pool, redis_client) -> ScenarioRouteResources:
    from app.routes.v5.tools.resources.descriptions.create import create_description
    from app.routes.v5.tools.resources.names.create import create_name
    from app.routes.v5.tools.resources.problem_statements.create import (
        create_problem_statement,
    )

    tag = unique_tag()
    name = f"Route Scenario {tag}"
    description = f"Route scenario description {tag}"
    problem_statement_name = f"Route Problem {tag}"
    problem_statement = f"Patient presents with route scenario symptoms {tag}."

    async with pool.acquire() as conn:
        name_res = await create_name(conn, name, redis_client)
        description_res = await create_description(conn, description, redis_client)
        problem_statement_res = await create_problem_statement(
            conn,
            name=problem_statement_name,
            problem_statement=problem_statement,
            redis=redis_client,
        )

    return ScenarioRouteResources(
        name_id=name_res.id,
        name=name_res.name,
        description_id=description_res.id,
        description=description_res.description,
        problem_statement_id=problem_statement_res.id,
        problem_statement_name=problem_statement_res.name,
        problem_statement=problem_statement_res.problem_statement,
    )


@pytest_asyncio.fixture
async def scenario_route_actor(pool, redis_client, setting_graph_factory):
    return await _create_scenario_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
    )


@pytest.mark.asyncio
class TestScenarioRoute:
    async def test_create_scenario_route_uses_real_http_stack(
        self,
        pool,
        redis_client,
        v5_scenario_route_client,
        scenario_route_actor,
    ):
        resources = await _create_scenario_route_resources(pool, redis_client)
        v5_scenario_route_client.authenticate(
            profile_id=scenario_route_actor.profile_id,
            session_id=scenario_route_actor.session_id,
        )

        response = await v5_scenario_route_client.client.post(
            "/api/v5/artifacts/scenarios/create",
            json={
                "scenarios": [
                    {
                        "name_id": str(resources.name_id),
                        "description_id": str(resources.description_id),
                        "problem_statement_id": str(resources.problem_statement_id),
                        "department_ids": [str(scenario_route_actor.department_id)],
                    }
                ]
            },
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Invalidate-Tags"] == "scenarios"

        payload = response.json()
        assert payload["results"][0]["success"] is True
        assert payload["results"][0]["message"] == "Scenario created successfully"
        assert payload["results"][0]["scenario_id"] is not None

    async def test_get_scenario_route_returns_canonical_bundle(
        self,
        pool,
        redis_client,
        v5_scenario_route_client,
        scenario_route_actor,
    ):
        created = await self._create_scenario_via_route(
            pool,
            redis_client,
            v5_scenario_route_client,
            scenario_route_actor,
        )

        response = await v5_scenario_route_client.client.post(
            "/api/v5/artifacts/scenarios/get",
            json={"scenario_id": created["scenario_id"]},
            headers={"X-Bypass-Cache": "1"},
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Cache-Tags"] == "scenarios"
        assert response.headers["X-Cache-Hit"] == "0"

        payload = response.json()
        assert payload["actor_name"] == scenario_route_actor.name
        assert payload["scenario_exists"] is True
        assert payload["can_edit"] is True
        assert payload["group_id"] is not None
        assert payload["names"]["resource"]["name"] == created["name"]
        assert (
            payload["descriptions"]["resource"]["description"] == created["description"]
        )
        assert (
            payload["problem_statements"]["resource"]["problem_statement"]
            == created["problem_statement"]
        )

    async def test_search_scenario_route_returns_created_scenario(
        self,
        pool,
        redis_client,
        v5_scenario_route_client,
        scenario_route_actor,
    ):
        created = await self._create_scenario_via_route(
            pool,
            redis_client,
            v5_scenario_route_client,
            scenario_route_actor,
        )

        response = await v5_scenario_route_client.client.post(
            "/api/v5/artifacts/scenarios/search",
            json={
                "search": created["name"],
                "filter_department_ids": [str(scenario_route_actor.department_id)],
                "page_size": 10,
                "page_offset": 0,
            },
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Invalidate-Tags"] == "scenarios"

        payload = response.json()
        assert payload["actor_name"] == scenario_route_actor.name
        assert payload["total_count"] >= 1
        assert payload["import_fields"]
        assert any(
            scenario["scenario_id"] == created["scenario_id"]
            for scenario in payload["scenarios"]
        )

        created_scenario = next(
            scenario
            for scenario in payload["scenarios"]
            if scenario["scenario_id"] == created["scenario_id"]
        )
        assert created_scenario["name"] == created["name"]
        assert created_scenario["department_ids"] == [str(scenario_route_actor.department_id)]
        assert created_scenario["can_edit"] is True
        assert created_scenario["can_duplicate"] is True
        assert created_scenario["can_delete"] is True

    async def _create_scenario_via_route(
        self,
        pool,
        redis_client,
        v5_scenario_route_client,
        scenario_route_actor: ScenarioRouteActor,
    ) -> dict[str, str]:
        resources = await _create_scenario_route_resources(pool, redis_client)
        v5_scenario_route_client.authenticate(
            profile_id=scenario_route_actor.profile_id,
            session_id=scenario_route_actor.session_id,
        )

        response = await v5_scenario_route_client.client.post(
            "/api/v5/artifacts/scenarios/create",
            json={
                "scenarios": [
                    {
                        "name_id": str(resources.name_id),
                        "description_id": str(resources.description_id),
                        "problem_statement_id": str(resources.problem_statement_id),
                        "department_ids": [str(scenario_route_actor.department_id)],
                    }
                ]
            },
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        return {
            "scenario_id": payload["results"][0]["scenario_id"],
            "name": resources.name,
            "description": resources.description,
            "problem_statement_name": resources.problem_statement_name,
            "problem_statement": resources.problem_statement,
        }
