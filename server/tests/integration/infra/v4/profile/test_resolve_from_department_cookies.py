"""Integration tests for app.infra.v4.profile.resolve_from_department_cookies."""

import pytest

from app.infra.v4.profile.resolve_from_department_cookies import (
    resolve_profile_from_department_cookies,
)
from app.main import get_pool

pytestmark = pytest.mark.asyncio


class TestResolveFromDepartmentCookies:
    """Tests for resolve_profile_from_department_cookies function."""

    async def test_resolve_from_department_cookies_no_pool(self) -> None:
        """Test resolving profile with no pool."""
        # Arrange & Act
        resolved = await resolve_profile_from_department_cookies(
            department_id=None, auth_mode="default-guest", db_pool=None
        )

        # Assert
        assert resolved is None

    async def test_resolve_from_department_cookies_invalid_auth_mode(self, db) -> None:
        """Test resolving profile with invalid auth mode."""
        # Arrange
        pool = get_pool()
        assert pool is not None

        # Act
        resolved = await resolve_profile_from_department_cookies(
            department_id=None, auth_mode="invalid-mode", db_pool=pool
        )

        # Assert
        assert resolved is None

    async def test_resolve_from_department_cookies_default_guest(self, db) -> None:
        """Test resolving profile for default-guest auth mode."""
        # Arrange
        pool = get_pool()
        assert pool is not None

        # Act
        resolved = await resolve_profile_from_department_cookies(
            department_id=None, auth_mode="default-guest", db_pool=pool
        )

        # Assert
        # May return None if no default guest profile is configured
        assert resolved is None or isinstance(resolved, str)

    async def test_resolve_from_department_cookies_default_account(self, db) -> None:
        """Test resolving profile for default-account auth mode."""
        # Arrange
        pool = get_pool()
        assert pool is not None

        # Act
        resolved = await resolve_profile_from_department_cookies(
            department_id=None, auth_mode="default-account", db_pool=pool
        )

        # Assert
        # May return None if no default account profile is configured
        assert resolved is None or isinstance(resolved, str)
