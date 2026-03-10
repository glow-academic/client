"""End-to-end tests for the canonical persona HTTP routes."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import pytest
import pytest_asyncio

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.helpers import unique_tag


@dataclass(frozen=True)
class PersonaRouteActor:
    profile_id: UUID
    profiles_id: UUID
    session_id: UUID
    department_id: UUID
    name: str


@dataclass(frozen=True)
class PersonaRouteResources:
    name_id: UUID
    name: str
    description_id: UUID
    description: str
    color_id: UUID
    color_name: str
    color_hex_code: str
    icon_id: UUID
    icon_name: str
    icon_value: str
    instruction_id: UUID
    instruction_template: str


async def _create_persona_route_actor(
    pool,
    redis_client,
    setting_graph_factory,
) -> PersonaRouteActor:
    from app.routes.v5.tools.artifacts.profile.update import update_profile
    from app.routes.v5.tools.entries.groups.create import create_group
    from app.routes.v5.tools.resources.roles.create import create_role

    graph = await setting_graph_factory()

    async with pool.acquire() as conn:
        admin_role = await create_role(
            conn,
            role="admin",
            name=f"Persona Route Admin {unique_tag()}",
            description="Persona route test admin role",
            redis=redis_client,
        )
        await update_profile(
            conn,
            graph.profile_artifact_id,
            role_ids=[admin_role.id],
            redis=redis_client,
        )
        session = await create_session(conn, profile_id=graph.profile_resource_id)
        await create_group(conn, session_id=session.id, name="persona-route")

    identity = await resolve_profile_identity_context(
        pool,
        graph.profile_artifact_id,
        redis_client,
        session_id=session.id,
    )
    if identity is None:
        raise AssertionError("Expected route test actor identity to exist")

    return PersonaRouteActor(
        profile_id=graph.profile_artifact_id,
        profiles_id=graph.profile_resource_id,
        session_id=session.id,
        department_id=graph.department_id,
        name=identity.name,
    )


async def _create_persona_route_resources(
    pool,
    redis_client,
) -> PersonaRouteResources:
    from app.routes.v5.tools.resources.colors.create import create_color
    from app.routes.v5.tools.resources.descriptions.create import create_description
    from app.routes.v5.tools.resources.icons.create import create_icon
    from app.routes.v5.tools.resources.instructions.create import create_instruction
    from app.routes.v5.tools.resources.names.create import create_name

    tag = unique_tag()
    name = f"Route Persona {tag}"
    description = f"Route description {tag}"
    color_name = f"Route Yellow {tag}"
    icon_name = f"Route User {tag}"
    instruction_template = f"You are persona route test {tag}."
    color_hex_code = "#F5C542"
    icon_value = "user"

    async with pool.acquire() as conn:
        name_res = await create_name(conn, name, redis_client)
        description_res = await create_description(conn, description, redis_client)
        color_res = await create_color(
            conn,
            color_name,
            f"Color for {tag}",
            color_hex_code,
            redis_client,
        )
        icon_res = await create_icon(
            conn,
            icon_name,
            f"Icon for {tag}",
            icon_value,
            redis_client,
        )
        instruction_res = await create_instruction(
            conn,
            instruction_template,
            redis_client,
        )

    return PersonaRouteResources(
        name_id=name_res.id,
        name=name_res.name,
        description_id=description_res.id,
        description=description_res.description,
        color_id=color_res.id,
        color_name=color_res.name,
        color_hex_code=color_res.hex_code,
        icon_id=icon_res.id,
        icon_name=icon_res.name,
        icon_value=icon_res.value,
        instruction_id=instruction_res.id,
        instruction_template=instruction_res.template,
    )


@pytest_asyncio.fixture
async def persona_route_actor(pool, redis_client, setting_graph_factory):
    return await _create_persona_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
    )


@pytest.mark.asyncio
class TestPersonaRoute:
    async def test_create_persona_route_uses_real_http_stack(
        self,
        pool,
        redis_client,
        v5_persona_route_client,
        persona_route_actor,
    ):
        resources = await _create_persona_route_resources(pool, redis_client)
        v5_persona_route_client.authenticate(
            profile_id=persona_route_actor.profile_id,
            session_id=persona_route_actor.session_id,
        )

        response = await v5_persona_route_client.client.post(
            "/api/v5/artifacts/personas/create",
            json={
                "personas": [
                    {
                        "name_id": str(resources.name_id),
                        "description_id": str(resources.description_id),
                        "color_id": str(resources.color_id),
                        "icon_id": str(resources.icon_id),
                        "instructions_id": str(resources.instruction_id),
                        "department_ids": [str(persona_route_actor.department_id)],
                    }
                ]
            },
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Invalidate-Tags"] == "personas"

        payload = response.json()
        assert payload["results"][0]["success"] is True
        assert payload["results"][0]["message"] == "Persona created successfully"
        assert payload["results"][0]["persona_id"] is not None

    async def test_get_persona_route_returns_canonical_bundle(
        self,
        pool,
        redis_client,
        v5_persona_route_client,
        persona_route_actor,
    ):
        created = await self._create_persona_via_route(
            pool,
            redis_client,
            v5_persona_route_client,
            persona_route_actor,
        )

        response = await v5_persona_route_client.client.post(
            "/api/v5/artifacts/personas/get",
            json={"persona_id": created["persona_id"]},
            headers={"X-Bypass-Cache": "1"},
        )

        assert response.status_code == 200, response.text
        assert response.headers["X-Cache-Tags"] == "personas"
        assert response.headers["X-Cache-Hit"] == "0"

        payload = response.json()
        assert payload["actor_name"] == persona_route_actor.name
        assert payload["persona_exists"] is True
        assert payload["can_edit"] is True
        assert payload["group_id"] is not None
        assert payload["names"]["resource"]["name"] == created["name"]
        assert payload["descriptions"]["resource"]["description"] == created["description"]
        assert payload["colors"]["resource"]["name"] == created["color_name"]
        assert payload["icons"]["resource"]["name"] == created["icon_name"]
        assert (
            payload["instructions"]["resource"]["template"]
            == created["instruction_template"]
        )
        assert {
            department["department_id"] for department in payload["departments"]["current"]
        } == {str(persona_route_actor.department_id)}

    async def test_search_persona_route_returns_created_persona(
        self,
        pool,
        redis_client,
        v5_persona_route_client,
        persona_route_actor,
    ):
        created = await self._create_persona_via_route(
            pool,
            redis_client,
            v5_persona_route_client,
            persona_route_actor,
        )

        response = await v5_persona_route_client.client.post(
            "/api/v5/artifacts/personas/search",
            json={
                "search": created["name"],
                "filter_department_ids": [str(persona_route_actor.department_id)],
                "page_size": 10,
                "page_offset": 0,
            },
        )

        assert response.status_code == 200
        assert response.headers["X-Invalidate-Tags"] == "personas"

        payload = response.json()
        assert payload["actor_name"] == persona_route_actor.name
        assert payload["total_count"] >= 1
        assert payload["import_fields"]
        assert any(
            persona["persona_id"] == created["persona_id"] for persona in payload["personas"]
        )

        created_persona = next(
            persona
            for persona in payload["personas"]
            if persona["persona_id"] == created["persona_id"]
        )
        assert created_persona["name"] == created["name"]
        assert created_persona["description"] == created["description"]
        assert created_persona["color"] == created["color_hex_code"]
        assert created_persona["icon"] == created["icon_value"]
        assert created_persona["can_edit"] is True
        assert created_persona["can_duplicate"] is True
        assert created_persona["can_delete"] is True

    async def _create_persona_via_route(
        self,
        pool,
        redis_client,
        v5_persona_route_client,
        persona_route_actor: PersonaRouteActor,
    ) -> dict[str, str]:
        resources = await _create_persona_route_resources(pool, redis_client)
        v5_persona_route_client.authenticate(
            profile_id=persona_route_actor.profile_id,
            session_id=persona_route_actor.session_id,
        )

        response = await v5_persona_route_client.client.post(
            "/api/v5/artifacts/personas/create",
            json={
                "personas": [
                    {
                        "name_id": str(resources.name_id),
                        "description_id": str(resources.description_id),
                        "color_id": str(resources.color_id),
                        "icon_id": str(resources.icon_id),
                        "instructions_id": str(resources.instruction_id),
                        "department_ids": [str(persona_route_actor.department_id)],
                    }
                ]
            },
        )

        assert response.status_code == 200
        payload = response.json()
        return {
            "persona_id": payload["results"][0]["persona_id"],
            "name": resources.name,
            "description": resources.description,
            "color_name": resources.color_name,
            "color_hex_code": resources.color_hex_code,
            "icon_name": resources.icon_name,
            "icon_value": resources.icon_value,
            "instruction_template": resources.instruction_template,
        }
