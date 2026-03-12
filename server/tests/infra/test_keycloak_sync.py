from __future__ import annotations

import sys
import types

import pytest

from app.infra.identity import keycloak_sync
from app.infra.identity.keycloak_sync import KeycloakSyncConfig


def make_config(**overrides) -> KeycloakSyncConfig:
    """Create a test config with sensible defaults."""
    defaults = {
        "auth_keycloak_id": "glow-client",
        "auth_keycloak_secret": "secret",
        "client_port": "3000",
        "app_prefix": "",
        "origin": "http://localhost:3000",
        "auth_secret": "test-secret",
        "keycloak_url": None,
        "keycloak_internal_url": None,
        "keycloak_admin": "admin",
        "keycloak_admin_password": "admin",
        "docker_env": None,
        "mcp_token_lifespan": 86400,
    }
    defaults.update(overrides)
    return KeycloakSyncConfig(**defaults)


class FakeConn:
    def __init__(self, fetch_result=None):
        self.fetch_result = fetch_result or []
        self.executed: list[tuple[str, tuple]] = []

    async def execute(self, sql, *args):
        self.executed.append((sql, args))

    async def fetch(self, sql, *args):
        self.executed.append((sql, args))
        return self.fetch_result


class FakeAcquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakePool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return FakeAcquire(self.conn)


class FakeKCAdmin:
    def __init__(self):
        self.current_realm = None
        self.updated_clients: list[tuple[str, dict]] = []
        self.created_clients: list[tuple[dict, bool]] = []
        self.updated_realms: list[tuple[str, dict]] = []
        self.deleted_components: list[str] = []
        self.added_mapper_payloads: list[tuple[str, dict]] = []
        self.updated_mapper_payloads: list[tuple[str, str, dict]] = []
        self.added_realm_default_scope_ids: list[str] = []
        self.added_client_default_scope_ids: list[tuple[str, str, dict]] = []
        self.updated_client_scopes: list[tuple[str, dict]] = []
        self.idps_created: list[dict] = []
        self.idps_updated: list[tuple[str, dict]] = []
        self.clients = []
        self.client_scopes = []
        self.realm_default_scopes = []
        self.client_default_scopes = []
        self.components = []
        self.realm = {
            "id": "realm-id",
            "accessTokenLifespan": 60,
            "sslRequired": "EXTERNAL",
        }
        self.scope_mappers: dict[str, list[dict]] = {}
        self.idps: dict[str, dict] = {}

    def get_realms(self):
        return [{"realm": "master"}]

    def change_current_realm(self, realm_name):
        self.current_realm = realm_name

    def get_realm(self, realm_name):
        return dict(self.realm)

    def update_realm(self, realm_name, payload):
        self.updated_realms.append((realm_name, payload))
        self.realm.update(payload)

    def get_clients(self):
        return list(self.clients)

    def update_client(self, client_id, payload):
        self.updated_clients.append((client_id, payload))

    def create_client(self, payload, skip_exists=True):
        self.created_clients.append((payload, skip_exists))
        return "new-client-uuid"

    def get_client_scopes(self):
        return list(self.client_scopes)

    def create_client_scope(self, payload, skip_exists=True):
        self.client_scopes.append({"id": "scope-id", "name": payload["name"]})
        return "scope-id"

    def update_client_scope(self, client_scope_id, payload):
        self.updated_client_scopes.append((client_scope_id, payload))

    def get_mappers_from_client_scope(self, scope_id):
        return list(self.scope_mappers.get(scope_id, []))

    def update_mapper_in_client_scope(
        self, client_scope_id, protocol_mapper_id, payload
    ):
        self.updated_mapper_payloads.append(
            (client_scope_id, protocol_mapper_id, payload)
        )

    def add_mapper_to_client_scope(self, client_scope_id, payload):
        self.added_mapper_payloads.append((client_scope_id, payload))

    def get_realm_default_client_scopes(self):
        return list(self.realm_default_scopes)

    def add_default_default_client_scope(self, scope_id):
        self.added_realm_default_scope_ids.append(scope_id)

    def get_client_default_client_scopes(self, client_id):
        return list(self.client_default_scopes)

    def add_client_default_client_scope(self, client_id, client_scope_id, payload):
        self.added_client_default_scope_ids.append(
            (client_id, client_scope_id, payload)
        )

    def get_components(self, query=None):
        return list(self.components)

    def delete_component(self, component_id):
        self.deleted_components.append(component_id)

    def get_idp(self, idp_alias):
        if idp_alias not in self.idps:
            raise KeyError(idp_alias)
        return self.idps[idp_alias]

    def update_idp(self, idp_alias, payload):
        self.idps_updated.append((idp_alias, payload))

    def create_idp(self, payload):
        self.idps_created.append(payload)


@pytest.mark.asyncio
async def test_wait_for_keycloak_connects(monkeypatch):
    kc_admin = FakeKCAdmin()

    class FakeKeycloakAdmin:
        def __new__(cls, *args, **kwargs):
            return kc_admin

    module = types.SimpleNamespace(KeycloakAdmin=FakeKeycloakAdmin)
    monkeypatch.setitem(sys.modules, "keycloak", module)

    result = await keycloak_sync.wait_for_keycloak(
        "http://keycloak:8080", "admin", "password", max_retries=1
    )

    assert result is kc_admin


@pytest.mark.asyncio
async def test_wait_for_keycloak_returns_none_when_package_missing(monkeypatch):
    monkeypatch.delitem(sys.modules, "keycloak", raising=False)
    original_import = __import__

    def fake_import(name, *args, **kwargs):
        if name == "keycloak":
            raise ImportError("missing")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", fake_import)

    assert (
        await keycloak_sync.wait_for_keycloak(
            "http://keycloak:8080", "admin", "password", max_retries=1
        )
        is None
    )


@pytest.mark.asyncio
async def test_ensure_department_client_updates_existing_client():
    admin = FakeKCAdmin()
    admin.clients = [{"clientId": "glow-client-dept-1", "id": "client-uuid"}]
    config = make_config()

    result = await keycloak_sync.ensure_department_client(
        "dept-1", "Operations", admin, config
    )

    assert result == "glow-client-dept-1"
    assert admin.updated_clients
    assert admin.updated_clients[0][0] == "client-uuid"


@pytest.mark.asyncio
async def test_ensure_department_client_creates_new_client():
    admin = FakeKCAdmin()
    config = make_config()

    result = await keycloak_sync.ensure_department_client(
        "dept-2", "People", admin, config
    )

    assert result == "glow-client-dept-2"
    assert admin.created_clients
    assert admin.updated_clients[-1][1] == {"secret": "secret"}


@pytest.mark.asyncio
async def test_ensure_glow_client_in_master_realm_creates_client():
    admin = FakeKCAdmin()
    config = make_config()

    await keycloak_sync.ensure_glow_client_in_master_realm(admin, config)

    assert admin.created_clients
    assert admin.updated_clients[-1][1] == {"secret": "secret"}


@pytest.mark.asyncio
async def test_ensure_mcp_client_scope_creates_scope_mapper_and_assignments(
    monkeypatch,
):
    admin = FakeKCAdmin()
    admin.clients = [{"clientId": "glow-client", "id": "client-1"}]
    config = make_config()
    monkeypatch.setattr(keycloak_sync, "is_mcp_enabled", lambda: True)

    await keycloak_sync.ensure_mcp_client_scope(admin, config)

    assert admin.added_mapper_payloads
    assert admin.added_realm_default_scope_ids == ["scope-id"]
    assert admin.added_client_default_scope_ids == [("client-1", "scope-id", {})]


@pytest.mark.asyncio
async def test_ensure_mcp_token_lifespan_updates_master_realm(monkeypatch):
    admin = FakeKCAdmin()
    config = make_config(mcp_token_lifespan=7200)
    monkeypatch.setattr(keycloak_sync, "is_mcp_enabled", lambda: True)

    await keycloak_sync.ensure_mcp_token_lifespan(admin, config)

    assert ("master", {"accessTokenLifespan": 7200}) in admin.updated_realms


@pytest.mark.asyncio
async def test_ensure_client_registration_policies_removes_blocking_components():
    admin = FakeKCAdmin()
    admin.components = [
        {
            "id": "trusted-1",
            "providerId": "trusted-hosts",
            "subType": "anonymous",
            "providerType": "org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy",
        },
        {
            "id": "consent-1",
            "providerId": "consent-required",
            "subType": "anonymous",
            "providerType": "org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy",
        },
    ]

    await keycloak_sync.ensure_client_registration_policies(admin)

    assert admin.deleted_components == ["trusted-1", "consent-1"]


@pytest.mark.asyncio
async def test_ensure_dynamic_clients_no_consent_updates_matching_clients(monkeypatch):
    admin = FakeKCAdmin()
    admin.clients = [
        {
            "clientId": "ChatGPT-123",
            "id": "chatgpt-id",
            "consentRequired": True,
            "redirectUris": ["https://chatgpt.com/callback"],
        },
        {
            "clientId": "glow-client",
            "id": "managed-id",
            "consentRequired": True,
            "redirectUris": [],
        },
        {
            "clientId": "123e4567-e89b-12d3-a456-426614174000",
            "id": "uuid-id",
            "consentRequired": True,
            "redirectUris": ["cursor://callback"],
        },
    ]
    monkeypatch.setattr(keycloak_sync, "is_mcp_enabled", lambda: True)

    await keycloak_sync.ensure_dynamic_clients_no_consent(admin)

    updated_ids = [client_id for client_id, _ in admin.updated_clients]
    assert "chatgpt-id" in updated_ids
    assert "uuid-id" in updated_ids
    assert "managed-id" not in updated_ids


@pytest.mark.asyncio
async def test_ensure_default_scopes_no_consent_updates_scope_attributes():
    admin = FakeKCAdmin()
    admin.client_scopes = [
        {"id": "scope-1", "name": "profile", "attributes": {}},
        {"id": "scope-2", "name": "email", "attributes": {}},
        {"id": "scope-3", "name": "custom-unrelated", "attributes": {}},
    ]

    await keycloak_sync.ensure_default_scopes_no_consent(admin)

    # Should update profile and email scopes (they're in the target set)
    updated_scope_ids = [scope_id for scope_id, _ in admin.updated_client_scopes]
    assert "scope-1" in updated_scope_ids
    assert "scope-2" in updated_scope_ids
    # Should NOT update custom-unrelated (not in the target set)
    assert "scope-3" not in updated_scope_ids
