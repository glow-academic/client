"""Integration tests for app.infra.v4.profile.resolve_from_department."""

import asyncpg
import pytest

from app.infra.v4.profile.resolve_from_department import resolve_profile_from_department

pytestmark = pytest.mark.asyncio


class TestResolveFromDepartment:
    """Tests for resolve_profile_from_department function."""

    async def test_resolve_from_department_returns_none(
        self, db: asyncpg.Connection
    ) -> None:
        """Profile resolution is disabled without explicit profile IDs."""
        resolved = await resolve_profile_from_department(
            department_id=None, auth_mode="default-guest", conn=db
        )

        assert resolved is None
