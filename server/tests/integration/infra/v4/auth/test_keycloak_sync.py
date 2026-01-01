"""Integration tests for app.infra.v4.auth.keycloak_sync."""

import pytest

from app.infra.v4.auth.keycloak_sync import perform_keycloak_sync, sync_keycloak

pytestmark = pytest.mark.asyncio


class TestKeycloakSync:
    """Tests for keycloak sync functions."""

    async def test_sync_keycloak_structure(self) -> None:
        """Test sync_keycloak function structure."""
        # This function is complex and requires Keycloak setup
        # For now, we verify it exists and is callable
        assert callable(sync_keycloak)

    async def test_perform_keycloak_sync_structure(self) -> None:
        """Test perform_keycloak_sync function structure."""
        # This function is complex and requires Keycloak setup
        # For now, we verify it exists and is callable
        assert callable(perform_keycloak_sync)

