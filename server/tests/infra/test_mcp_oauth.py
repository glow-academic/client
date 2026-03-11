from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from app.routes.mcp import oauth


def _request_with_headers(headers: list[tuple[bytes, bytes]]):
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/mcp",
            "headers": headers,
            "query_string": b"",
            "server": ("test", 8000),
            "client": ("test", 1234),
            "scheme": "http",
        }
    )


def test_bearer_from_request_parses_authorization_header():
    request = _request_with_headers([(b"authorization", b"Bearer token-123")])
    assert oauth.bearer_from_request(request) == "token-123"

    no_auth = _request_with_headers([])
    assert oauth.bearer_from_request(no_auth) is None

    malformed = _request_with_headers([(b"authorization", b"Basic abc")])
    assert oauth.bearer_from_request(malformed) is None


def test_oauth_401_points_clients_to_mcp_resource_metadata():
    response = oauth.oauth_401()

    assert response.status_code == 401
    header = response.headers["WWW-Authenticate"]
    assert 'resource="' in header
    assert 'resource_metadata="' in header
    assert 'authorization_uri="' in header
    assert 'scope="mcp-resource"' in header


def test_get_jwks_fetches_and_caches_first_working_endpoint(monkeypatch):
    oauth._jwks_cache.update({"keys": None, "ts": 0.0, "url": None})
    calls: list[str] = []

    class FakeResponse:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self._payload

    def fake_get(url, timeout):
        calls.append(url)
        if len(calls) == 1:
            raise RuntimeError("unavailable")
        return FakeResponse({"keys": [{"kid": "kid-1"}]})

    monkeypatch.setattr(oauth, "_can_resolve_hostname", lambda hostname: True)
    monkeypatch.setattr(oauth.requests, "get", fake_get)

    keys = oauth.get_jwks()
    cached = oauth.get_jwks()

    assert keys == [{"kid": "kid-1"}]
    assert cached == keys
    assert len(calls) == 2


def test_get_jwks_uses_expired_cache_when_refresh_fails(monkeypatch):
    oauth._jwks_cache.update({"keys": [{"kid": "cached"}], "ts": 0.0, "url": "cached-url"})

    monkeypatch.setattr(oauth, "_can_resolve_hostname", lambda hostname: True)
    monkeypatch.setattr(
        oauth.requests,
        "get",
        lambda url, timeout: (_ for _ in ()).throw(RuntimeError("boom")),
    )

    assert oauth.get_jwks() == [{"kid": "cached"}]


def test_get_jwks_raises_when_all_endpoints_fail_without_cache(monkeypatch):
    oauth._jwks_cache.update({"keys": None, "ts": 0.0, "url": None})
    monkeypatch.setattr(oauth, "_can_resolve_hostname", lambda hostname: True)
    monkeypatch.setattr(
        oauth.requests,
        "get",
        lambda url, timeout: (_ for _ in ()).throw(RuntimeError("boom")),
    )

    with pytest.raises(RuntimeError, match="Failed to fetch JWKS"):
        oauth.get_jwks()


def test_verify_token_validates_jwt_claims(monkeypatch):
    monkeypatch.setattr(oauth.jwt, "get_unverified_header", lambda token: {"kid": "kid-1", "alg": "RS256"})
    monkeypatch.setattr(oauth, "get_jwks", lambda: [{"kid": "kid-1"}])
    monkeypatch.setattr(
        oauth.jwt,
        "decode",
        lambda token, key, algorithms, options: {
            "iss": oauth.KEYCLOAK_ISSUER,
            "aud": [oauth.MCP_RESOURCE],
            "sub": "user-1",
        },
    )

    claims = oauth.verify_token("token-123")

    assert claims["sub"] == "user-1"


def test_verify_token_rejects_missing_kid(monkeypatch):
    monkeypatch.setattr(oauth.jwt, "get_unverified_header", lambda token: {})

    with pytest.raises(ValueError, match="missing kid"):
        oauth.verify_token("token-123")


def test_verify_token_rejects_unknown_jwk(monkeypatch):
    monkeypatch.setattr(oauth.jwt, "get_unverified_header", lambda token: {"kid": "missing", "alg": "RS256"})
    monkeypatch.setattr(oauth, "get_jwks", lambda: [{"kid": "kid-1"}])

    with pytest.raises(ValueError, match="No matching JWK"):
        oauth.verify_token("token-123")


def test_verify_token_rejects_issuer_mismatch(monkeypatch):
    monkeypatch.setattr(oauth.jwt, "get_unverified_header", lambda token: {"kid": "kid-1", "alg": "RS256"})
    monkeypatch.setattr(oauth, "get_jwks", lambda: [{"kid": "kid-1"}])
    monkeypatch.setattr(
        oauth.jwt,
        "decode",
        lambda token, key, algorithms, options: {
            "iss": "https://evil.example/realm",
            "aud": [oauth.MCP_RESOURCE],
        },
    )

    with pytest.raises(ValueError, match="issuer"):
        oauth.verify_token("token-123")


def test_verify_token_rejects_audience_mismatch(monkeypatch):
    monkeypatch.setattr(oauth.jwt, "get_unverified_header", lambda token: {"kid": "kid-1", "alg": "RS256"})
    monkeypatch.setattr(oauth, "get_jwks", lambda: [{"kid": "kid-1"}])
    monkeypatch.setattr(
        oauth.jwt,
        "decode",
        lambda token, key, algorithms, options: {
            "iss": oauth.KEYCLOAK_ISSUER,
            "aud": ["other-audience"],
        },
    )

    with pytest.raises(ValueError, match="audience"):
        oauth.verify_token("token-123")


def test_verify_token_allows_missing_audience(monkeypatch):
    monkeypatch.setattr(oauth.jwt, "get_unverified_header", lambda token: {"kid": "kid-1", "alg": "RS256"})
    monkeypatch.setattr(oauth, "get_jwks", lambda: [{"kid": "kid-1"}])
    monkeypatch.setattr(
        oauth.jwt,
        "decode",
        lambda token, key, algorithms, options: {
            "iss": oauth.KEYCLOAK_ISSUER,
            "sub": "user-1",
        },
    )

    claims = oauth.verify_token("token-123")
    assert claims["sub"] == "user-1"


def test_verify_token_wraps_expired_signature(monkeypatch):
    monkeypatch.setattr(oauth.jwt, "get_unverified_header", lambda token: {"kid": "kid-1", "alg": "RS256"})
    monkeypatch.setattr(oauth, "get_jwks", lambda: [{"kid": "kid-1"}])
    monkeypatch.setattr(
        oauth.jwt,
        "decode",
        lambda token, key, algorithms, options: (_ for _ in ()).throw(oauth.jwt.ExpiredSignatureError()),
    )

    with pytest.raises(ValueError, match="Token expired"):
        oauth.verify_token("token-123")


@pytest.mark.asyncio
async def test_mcp_oauth_middleware_handles_metadata_and_auth_paths(monkeypatch):
    app = FastAPI()
    app.add_middleware(oauth.McpOAuthMiddleware)

    @app.api_route("/mcp", methods=["GET", "POST"])
    async def mcp_endpoint(request: Request):
        return {
            "profile_id": getattr(request.state, "profile_id", None),
            "claims": getattr(request.state, "mcp_claims", None),
        }

    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        auth_meta = await client.get("/.well-known/oauth-authorization-server")
        assert auth_meta.status_code == 200
        assert auth_meta.json()["issuer"] == oauth.KEYCLOAK_ISSUER

        prm = await client.get("/.well-known/oauth-protected-resource")
        assert prm.status_code == 200
        assert prm.json()["resource"] == oauth.MCP_RESOURCE

        missing = await client.get("/mcp")
        assert missing.status_code == 401

        monkeypatch.setattr(oauth, "is_mcp_enabled", lambda: False)
        disabled = await client.get("/mcp", headers={"Authorization": "Bearer token"})
        assert disabled.status_code == 503


@pytest.mark.asyncio
async def test_mcp_oauth_middleware_rewrites_sse_and_messages_paths(monkeypatch):
    app = FastAPI()
    app.add_middleware(oauth.McpOAuthMiddleware)

    @app.api_route("/mcp", methods=["GET", "POST"])
    async def mcp_endpoint(request: Request):
        return {"path": request.scope["path"]}

    monkeypatch.setattr(oauth, "is_mcp_enabled", lambda: True)
    monkeypatch.setattr(oauth, "verify_token", lambda token: {"sub": "subject-1"})

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        sse = await client.get("/mcp/sse/", headers={"Authorization": "Bearer token-123"})
        messages = await client.post("/mcp/messages", headers={"Authorization": "Bearer token-123"})

    assert sse.status_code == 200
    assert sse.json()["path"] == "/mcp"
    assert messages.status_code == 200
    assert messages.json()["path"] == "/mcp"


@pytest.mark.asyncio
async def test_mcp_oauth_middleware_returns_401_on_invalid_token(monkeypatch):
    app = FastAPI()
    app.add_middleware(oauth.McpOAuthMiddleware)

    @app.get("/mcp")
    async def mcp_endpoint():
        return {"ok": True}

    monkeypatch.setattr(oauth, "is_mcp_enabled", lambda: True)
    monkeypatch.setattr(oauth, "verify_token", lambda token: (_ for _ in ()).throw(ValueError("bad token")))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/mcp", headers={"Authorization": "Bearer token-123"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mcp_oauth_middleware_attaches_profile_context(monkeypatch):
    app = FastAPI()
    app.add_middleware(oauth.McpOAuthMiddleware)

    @app.get("/mcp")
    async def mcp_endpoint(request: Request):
        return {
            "profile_id": request.state.profile_id,
            "claims_sub": request.state.mcp_claims["sub"],
        }

    class FakeAcquire:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    async def fake_get_profile_id_from_claims(claims, conn):
        return "profile-123"

    monkeypatch.setattr(oauth, "is_mcp_enabled", lambda: True)
    monkeypatch.setattr(oauth, "verify_token", lambda token: {"sub": "subject-1", "email": "user@example.com"})
    monkeypatch.setattr("app.infra.globals.get_pool", lambda: FakePool())
    monkeypatch.setattr(
        "app.utils.mcp.get_profile_id_from_claims.get_profile_id_from_claims",
        fake_get_profile_id_from_claims,
    )
    monkeypatch.setattr("app.utils.logging.db_logger.set_profile_id", lambda profile_id: None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/mcp", headers={"Authorization": "Bearer token-123"})

    assert response.status_code == 200
    assert response.json() == {
        "profile_id": "profile-123",
        "claims_sub": "subject-1",
    }
