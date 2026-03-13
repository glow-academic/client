from __future__ import annotations

from uuid import uuid4

import pytest
import pytest_asyncio

from app.infra.mcp import endpoints
from tests.infra.route_helpers import create_admin_route_actor


@pytest_asyncio.fixture
async def mcp_actor(pool, redis_client, setting_graph_factory):
    return await create_admin_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
        tool_artifacts=["persona"],
        group_name="mcp-endpoints",
        role_name_prefix="MCP Endpoint Admin",
    )


async def _create_persona_id(pool, redis_client, department_id):
    from app.tools.artifacts.persona.create import create_persona
    from app.tools.resources.names.create import create_name

    async with pool.acquire() as conn:
        name = await create_name(conn, f"mcp-persona-{uuid4()}", redis_client)
        persona = await create_persona(
            conn,
            name_id=name.id,
            department_ids=[department_id],
        )
    return persona.id


def test_get_payload_schema_uses_real_persona_request_model() -> None:
    schema = endpoints.get_payload_schema("persona", "get")

    assert schema["type"] == "object"
    assert "persona_id" in schema["properties"]
    assert "mcp" not in schema["properties"]


def test_related_name_resolution_links_artifact_resource_and_entry() -> None:
    related = endpoints._resolve_related_names("persona")

    assert related["artifact"] == "persona"
    assert related["resource"] == "personas"
    assert related["entry"] == "persona"


@pytest.mark.asyncio
async def test_call_endpoint_handler_executes_real_persona_get_handler(
    pool,
    redis_client,
    mcp_actor,
):
    import app.infra.globals as globals_mod
    from app.routes.v5.persona.get import get_persona

    persona_id = await _create_persona_id(
        pool,
        redis_client,
        mcp_actor.department_id,
    )

    prior_pool = globals_mod._db_pool
    prior_redis = globals_mod.redis_client
    globals_mod._db_pool = pool
    globals_mod.redis_client = redis_client
    try:
        result = await endpoints.call_endpoint_handler(
            get_persona,
            {"persona_id": str(persona_id)},
            str(mcp_actor.profile_id),
        )
    finally:
        globals_mod._db_pool = prior_pool
        globals_mod.redis_client = prior_redis

    assert "error" not in result
    assert result["persona_exists"] is True
    assert result["actor_name"] == mcp_actor.name
    assert result["names"] is not None


@pytest.mark.asyncio
async def test_call_handler_returns_not_implemented_for_unknown_artifact() -> None:
    result = await endpoints.call_handler("not_real", "get", {})

    assert result["status"] == "not_implemented"
    assert "available_artifacts" in result


def test_name_resolution_helpers_cover_pluralization_and_descriptions() -> None:
    assert endpoints.pluralize_artifact("persona") == "personas"
    assert endpoints.pluralize_artifact("policy") == "policies"
    assert (
        endpoints.get_artifact_description("persona")
        == "Get persona information using the canonical shared persona operation"
    )
    assert (
        endpoints.get_resource_description("personas")
        == "Fetch personas_resource entries by IDs"
    )
    assert endpoints.get_entry_description("persona") == "Persona entry"


def test_get_available_operations_and_schema_fallbacks() -> None:
    assert "get" in endpoints.get_available_operations("persona")
    assert endpoints.get_available_operations("missing") == []

    schema = endpoints.get_payload_schema("missing-item", "get")
    assert "error" in schema

    assert endpoints.format_example_payload("persona", "duplicate").startswith(
        '{"persona_id"'
    )


@pytest.mark.asyncio
async def test_call_handler_returns_not_implemented_for_unknown_operation() -> None:
    result = await endpoints.call_handler("persona", "refresh", {})

    assert result["status"] == "not_implemented"
    assert "available_operations" in result


@pytest.mark.asyncio
async def test_call_endpoint_handler_uses_legacy_conn_path(monkeypatch) -> None:
    class LegacyRequest:
        def __init__(self, value: str):
            self.value = value

    class LegacyResponse:
        def model_dump(self, mode="json"):
            return {"value": "ok"}

    async def legacy_handler(request: LegacyRequest, http_request, response, conn):
        assert request.value == "hi"
        assert http_request.state.mcp is True
        assert conn == "fake-conn"
        return LegacyResponse()

    async def _fake_get_db():
        yield "fake-conn"

    monkeypatch.setattr(endpoints, "get_request_model_from_handler", lambda handler: LegacyRequest)
    monkeypatch.setattr("app.infra.globals.get_db", _fake_get_db)

    result = await endpoints.call_endpoint_handler(
        legacy_handler,
        {"value": "hi"},
        str(uuid4()),
    )

    assert result == {"value": "ok"}


def test_register_endpoints_registers_tools_without_runtime_failures() -> None:
    class FakeServer:
        def __init__(self):
            self.tools: dict[str, object] = {}

        def tool(self, **kwargs):
            def _decorator(fn):
                self.tools[fn.__name__] = fn
                return fn

            return _decorator

    server = FakeServer()

    endpoints.register_endpoints(server)

    expected = {
        "dashboard",
        "attempt",
        "get_artifact",
        "create_resource",
        "create_entry",
        "discover_artifacts",
    }
    assert expected.issubset(server.tools.keys())
    assert len(server.tools) > 20
