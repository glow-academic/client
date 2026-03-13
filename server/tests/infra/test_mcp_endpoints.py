"""Behavior-first tests for MCP endpoint registry and tool wrappers."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import BaseModel

from app.routes.mcp import endpoints


class FakeMCPServer:
    def __init__(self) -> None:
        self.tools: dict[str, Any] = {}

    def tool(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        def decorator(fn):
            self.tools[fn.__name__] = fn
            return fn

        return decorator


class ExampleRequest(BaseModel):
    value: int
    mcp: bool = False


class ExampleResponse(BaseModel):
    echoed: int
    mcp: bool
    profile_id: str


def test_registry_name_helpers_cover_common_cases():
    assert endpoints.pluralize_artifact("persona") == "personas"
    assert endpoints.pluralize_artifact("activity") == "activities"
    assert endpoints._suggest_item_name("personas") is None
    assert endpoints._suggest_item_name("profile") == "profiles"
    assert endpoints._suggest_item_name("unknown") is None

    related = endpoints._resolve_related_names("persona")
    assert related["artifact"] == "persona"
    assert related["resource"] == "personas"

    assert endpoints.is_artifact("persona") is True
    assert endpoints.is_resource("personas") is True
    assert endpoints.is_entry("activity") is True
    assert "get" in endpoints.get_available_operations("persona")


def test_get_payload_schema_filters_mcp_from_request_model(monkeypatch):
    monkeypatch.setattr(
        endpoints,
        "_get_handler",
        lambda module_path, func_name: lambda request: request,
    )

    def fake_get_request_model(_handler):
        return ExampleRequest

    monkeypatch.setattr(
        endpoints,
        "get_request_model_from_handler",
        fake_get_request_model,
    )

    schema = endpoints.get_payload_schema("persona", "get")

    assert schema["type"] == "object"
    assert "mcp" not in schema["properties"]
    assert "value" in schema["properties"]


def test_get_payload_schema_returns_suggestion_for_unknown_item():
    schema = endpoints.get_payload_schema("profile", "save")

    assert schema["error"]
    assert schema["suggestion"] == "profiles"


@pytest.mark.asyncio
async def test_call_endpoint_handler_injects_mcp_without_conn():
    original = endpoints.get_request_model_from_handler
    endpoints.get_request_model_from_handler = lambda _handler: ExampleRequest

    async def handler(request: ExampleRequest, http_request, response):
        assert http_request.state.mcp is True
        return ExampleResponse(
            echoed=request.value,
            mcp=request.mcp,
            profile_id=http_request.state.profile_id,
        )

    try:
        result = await endpoints.call_endpoint_handler(
            handler,
            {"value": 7},
            "profile-123",
        )
    finally:
        endpoints.get_request_model_from_handler = original

    assert result == {"echoed": 7, "mcp": True, "profile_id": "profile-123"}


@pytest.mark.asyncio
async def test_call_endpoint_handler_uses_connection_generator(monkeypatch):
    fake_conn = object()

    async def fake_get_db():
        yield fake_conn

    monkeypatch.setattr("app.infra.globals.get_db", fake_get_db)
    original = endpoints.get_request_model_from_handler
    endpoints.get_request_model_from_handler = lambda _handler: ExampleRequest

    async def handler(request: ExampleRequest, http_request, response, conn):
        assert conn is fake_conn
        return ExampleResponse(
            echoed=request.value + 1,
            mcp=request.mcp,
            profile_id=http_request.state.profile_id,
        )

    try:
        result = await endpoints.call_endpoint_handler(
            handler,
            {"value": 4},
            "profile-456",
        )
    finally:
        endpoints.get_request_model_from_handler = original

    assert result == {"echoed": 5, "mcp": True, "profile_id": "profile-456"}


@pytest.mark.asyncio
async def test_call_handler_reports_invalid_artifact_and_operation(monkeypatch):
    monkeypatch.setattr(
        "app.utils.mcp.get_mcp_profile_id.get_mcp_profile_id",
        lambda: "profile-123",
    )

    missing = await endpoints.call_handler("unknown-artifact", "get", {})
    assert missing["status"] == "not_implemented"
    assert "available_artifacts" in missing

    invalid_op = await endpoints.call_handler("persona", "save", {})
    assert invalid_op["status"] == "not_implemented"
    assert "available_operations" in invalid_op


@pytest.mark.asyncio
async def test_call_handler_dispatches_to_endpoint_handler(monkeypatch):
    monkeypatch.setattr(
        "app.utils.mcp.get_mcp_profile_id.get_mcp_profile_id",
        lambda: "profile-abc",
    )

    async def fake_call_endpoint_handler(handler, payload, profile_id):
        assert profile_id == "profile-abc"
        assert payload == {"persona_id": "p-1"}
        return {"ok": True}

    monkeypatch.setattr(endpoints, "call_endpoint_handler", fake_call_endpoint_handler)
    monkeypatch.setattr(
        endpoints,
        "_get_handler",
        lambda module_path, func_name: object(),
    )

    result = await endpoints.call_handler("persona", "get", {"persona_id": "p-1"})

    assert result == {"ok": True}


@pytest.mark.asyncio
async def test_register_endpoints_exposes_and_invokes_public_tools(monkeypatch):
    server = FakeMCPServer()
    recorded: list[tuple[str, str, dict[str, Any]]] = []
    fake_conn = object()

    async def fake_call_handler(name: str, operation: str, payload: dict[str, Any]):
        recorded.append((name, operation, payload))
        return {
            "name": name,
            "operation": operation,
            "payload": payload,
        }

    monkeypatch.setattr(endpoints, "call_handler", fake_call_handler)
    monkeypatch.setattr(
        endpoints,
        "get_payload_schema",
        lambda name, operation="get": {
            "type": "object",
            "properties": {"name": {"type": "string"}},
        },
    )
    monkeypatch.setattr(
        endpoints,
        "get_artifact_description",
        lambda name: f"{name} artifact",
    )
    monkeypatch.setattr(
        endpoints,
        "get_resource_description",
        lambda name: f"{name} resource",
    )
    monkeypatch.setattr(
        endpoints,
        "get_entry_description",
        lambda name: f"{name} entry",
    )

    async def fake_get_db():
        yield fake_conn

    monkeypatch.setattr("app.infra.globals.get_db", fake_get_db)
    monkeypatch.setattr("app.infra.globals.get_redis_client", lambda: object())

    async def fake_resource_get_handler(conn, ids, redis=None):
        assert conn is fake_conn
        assert ids
        assert redis is not None
        return [
            ExampleResponse(
                echoed=len(ids),
                mcp=False,
                profile_id="resource-profile",
            )
        ]

    def fake_get_handler(module_path: str, func_name: str):
        if module_path == "app.routes.v5.tools.resources.profiles.get":
            assert func_name == "get_profiles"
            return fake_resource_get_handler
        if module_path == "app.infra.persona.docs":
            assert func_name == "docs_persona_impl"
            return lambda: {"title": "persona docs"}
        return object()

    monkeypatch.setattr(endpoints, "_get_handler", fake_get_handler)

    endpoints.register_endpoints(server)

    assert {
        "dashboard",
        "pricing",
        "reports",
        "leaderboard",
        "get_artifact",
        "get_resource",
        "docs",
        "discover_artifacts",
        "discover_resources",
        "discover_entries",
    }.issubset(server.tools.keys())

    dashboard = await server.tools["dashboard"](
        start_date="2026-01-01",
        kwargs={"extra": "value"},
    )
    pricing = await server.tools["pricing"](model_id="model-1")
    reports = await server.tools["reports"](search="ada", sort_by="score")
    leaderboard = await server.tools["leaderboard"](page_limit=5)
    chat = await server.tools["chat"](chat_entry_id="chat-1")
    attempt = await server.tools["attempt"](attempt_id="attempt-1")
    group = await server.tools["group"](group_id="group-1")
    get_artifact = await server.tools["get_artifact"](
        artifact="persona",
        artifact_id="persona-1",
        draft_id="draft-1",
        kwargs={"custom": True},
    )
    list_artifact = await server.tools["list_artifact"](
        artifact="persona",
        kwargs={"page_limit": 10},
    )
    delete_artifact = await server.tools["delete_artifact"](
        artifact="persona",
        artifact_id="persona-1",
    )
    duplicate_artifact = await server.tools["duplicate_artifact"](
        artifact="persona",
        artifact_id="persona-1",
        name="Copy",
    )
    draft_artifact = await server.tools["draft_artifact"](
        artifact="persona",
        payload={"name": "Draft Persona"},
    )

    assert dashboard["name"] == "dashboard"
    assert pricing["name"] == "pricing"
    assert reports["name"] == "reports"
    assert leaderboard["name"] == "leaderboard"
    assert chat["payload"] == {"chat_entry_id": "chat-1"}
    assert attempt["payload"] == {"attempt_id": "attempt-1"}
    assert group["payload"] == {"group_id": "group-1"}
    assert get_artifact["payload"] == {
        "persona_id": "persona-1",
        "draft_id": "draft-1",
        "custom": True,
    }
    assert list_artifact["operation"] == "search"
    assert delete_artifact["operation"] == "delete"
    assert duplicate_artifact["payload"]["name"] == "Copy"
    assert draft_artifact["operation"] == "draft"

    assert (
        "dashboard",
        "get",
        {"start_date": "2026-01-01", "extra": "value"},
    ) in recorded
    assert ("pricing", "get", {"model_id": "model-1"}) in recorded
    assert ("reports", "get", {"search": "ada", "sort_by": "score"}) in recorded
    assert ("leaderboard", "get", {"page_limit": 5}) in recorded


@pytest.mark.asyncio
async def test_register_endpoints_resource_entry_docs_and_discovery_tools(monkeypatch):
    server = FakeMCPServer()
    fake_conn = object()

    async def fake_call_handler(name: str, operation: str, payload: dict[str, Any]):
        return {"name": name, "operation": operation, "payload": payload}

    monkeypatch.setattr(endpoints, "call_handler", fake_call_handler)
    monkeypatch.setattr(
        "app.utils.mcp.get_mcp_profile_id.get_mcp_profile_id",
        lambda: "profile-xyz",
    )
    monkeypatch.setattr("app.infra.globals.get_redis_client", lambda: object())

    async def fake_get_db():
        yield fake_conn

    monkeypatch.setattr("app.infra.globals.get_db", fake_get_db)

    class ResourceRow(BaseModel):
        id: str

    async def fake_resource_get(conn, ids, redis=None):
        assert conn is fake_conn
        return [ResourceRow(id=str(ids[0]))]

    async def fake_resource_search(conn, redis=None, **kwargs):
        assert conn is fake_conn
        return [
            ResourceRow(id=f"search:{kwargs['limit_count']}:{kwargs.get('search', '')}")
        ]

    async def fake_resource_create(conn, redis=None, **payload):
        assert conn is fake_conn
        return ResourceRow(id=payload["name"])

    async def fake_entry_get(request, http_request, response):
        return ExampleResponse(
            echoed=len(request.ids or []),
            mcp=True,
            profile_id=http_request.state.profile_id,
        )

    async def fake_entry_search(request, http_request, response):
        return ExampleResponse(
            echoed=request.limit_count,
            mcp=True,
            profile_id=http_request.state.profile_id,
        )

    async def fake_entry_create(request, http_request, response):
        return ExampleResponse(
            echoed=request.value,
            mcp=request.mcp,
            profile_id=http_request.state.profile_id,
        )

    def fake_handler(module_path: str, func_name: str):
        table = {
            ("app.routes.v5.tools.resources.names.get", "get_names"): fake_resource_get,
            (
                "app.routes.v5.tools.resources.names.search",
                "search_names",
            ): fake_resource_search,
            (
                "app.routes.v5.tools.resources.names.create",
                "create_names",
            ): fake_resource_create,
            (
                "app.routes.v5.tools.resources.profiles.get",
                "get_profiles",
            ): fake_resource_get,
            (
                "app.routes.v5.tools.entries.problems.get",
                "get_problems_entries",
            ): fake_entry_get,
            (
                "app.routes.v5.tools.entries.problems.search",
                "search_problems_entries",
            ): fake_entry_search,
            (
                "app.routes.v5.tools.entries.problems.create",
                "create_problems_entry",
            ): fake_entry_create,
            ("app.infra.persona.docs", "docs_persona_impl"): lambda: {
                "persona": "docs"
            },
            (
                "app.routes.v5.tools.resources.personas.docs",
                "get_personas_docs",
            ): lambda: {"personas": "docs"},
            ("app.routes.v5.docs", "get_glow_docs"): lambda: {"glow": True},
        }
        return table[(module_path, func_name)]

    monkeypatch.setattr(endpoints, "_get_handler", fake_handler)
    monkeypatch.setattr(
        endpoints, "get_artifact_description", lambda name: f"artifact:{name}"
    )
    monkeypatch.setattr(
        endpoints, "get_resource_description", lambda name: f"resource:{name}"
    )
    monkeypatch.setattr(
        endpoints, "get_entry_description", lambda name: f"entry:{name}"
    )

    class EntryGetRequest(BaseModel):
        ids: list[str] | None = None

    class EntrySearchRequest(BaseModel):
        limit_count: int
        offset_count: int
        search: str | None = None

    monkeypatch.setattr(
        endpoints,
        "get_request_model_from_handler",
        lambda handler: {
            fake_entry_get: EntryGetRequest,
            fake_entry_search: EntrySearchRequest,
            fake_entry_create: ExampleRequest,
        }.get(handler),
    )

    endpoints.register_endpoints(server)

    resource = await server.tools["get_resource"](
        "names", ["123e4567-e89b-12d3-a456-426614174000"]
    )
    searched = await server.tools["search_resource"](
        "names", query="ada", limit=7, kwargs={"active_only": True}
    )
    created = await server.tools["create_resource"](
        "names", {"name": "new-name"}, group_id="group-1", tool_id="tool-1"
    )
    entry = await server.tools["get_entry"]("problems", ids=["p-1", "p-2"])
    searched_entry = await server.tools["search_entry"](
        "problems", query="issue", limit=9
    )
    created_entry = await server.tools["create_entry"]("problems", {"value": 8})
    docs_glow = server.tools["docs"]("glow")
    docs_merged = server.tools["docs"]("persona")
    docs_missing = server.tools["docs"]("unknown")
    refreshed = await server.tools["refresh"]("dashboard")
    refresh_error = await server.tools["refresh"]("persona")
    artifacts = server.tools["discover_artifacts"]()
    resources = server.tools["discover_resources"]()
    entries = server.tools["discover_entries"]()

    assert resource["items"][0]["id"] == "123e4567-e89b-12d3-a456-426614174000"
    assert searched["items"][0]["id"] == "search:7:ada"
    assert created["id"] == "new-name"
    assert entry["echoed"] == 2
    assert searched_entry["echoed"] == 9
    assert created_entry["echoed"] == 8
    assert docs_glow == {"glow": True}
    assert docs_merged["artifact_docs"] == {"persona": "docs"}
    assert docs_merged["resource_docs"] == {"personas": "docs"}
    assert docs_missing["error"]
    assert refreshed["name"] == "dashboard"
    assert refresh_error["error"] == "'persona' is not refreshable."
    assert artifacts[0]["description"].startswith("artifact:")
    assert resources[0]["description"].startswith("resource:")
    assert entries[0]["description"].startswith("entry:")
