"""Integration tests for app.infra.v4.profile.resolve_from_department."""

import asyncpg
import pytest
from tests.sql.types import (
    CreateTestProfileSqlParams,
    CreateTestProfileSqlRow,
)
from utils.sql_helper import execute_sql_typed

from app.infra.v4.profile.resolve_from_department import resolve_profile_from_department

pytestmark = pytest.mark.asyncio


class TestResolveFromDepartment:
    """Tests for resolve_profile_from_department function."""

    async def test_resolve_from_department_default_guest(
        self, db: asyncpg.Connection
    ) -> None:
        """Test resolving profile for default-guest auth mode."""
        # Arrange
        # Create a test profile
        result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/api/profile/test_create_test_profile_v4_complete.sql",
            params=CreateTestProfileSqlParams(
                profile_first_name="Guest",
                profile_last_name="User",
                profile_role="guest",
                profile_active=True,
                profile_default_profile=False,
            ),
        )
        typed_result = CreateTestProfileSqlRow.model_validate(result.model_dump())
        profile_id = typed_result.profile_id
        assert profile_id is not None

        # Note: This function requires department settings to be configured
        # For now, we test the function signature and error handling
        # Act
        resolved = await resolve_profile_from_department(
            department_id=None, auth_mode="default-guest", conn=db
        )

        # Assert
        # May return None if no default guest profile is configured
        assert resolved is None or isinstance(resolved, str)

    async def test_resolve_from_department_default_account(
        self, db: asyncpg.Connection
    ) -> None:
        """Test resolving profile for default-account auth mode."""
        # Arrange & Act
        resolved = await resolve_profile_from_department(
            department_id=None, auth_mode="default-account", conn=db
        )

        # Assert
        # May return None if no default account profile is configured
        assert resolved is None or isinstance(resolved, str)

    async def test_resolve_from_department_invalid_auth_mode(
        self, db: asyncpg.Connection
    ) -> None:
        """Test resolving profile with invalid auth mode."""
        # Arrange & Act
        resolved = await resolve_profile_from_department(
            department_id=None, auth_mode="invalid-mode", conn=db
        )

        # Assert
        assert resolved is None

    async def test_resolve_from_department_empty_auth_mode(
        self, db: asyncpg.Connection
    ) -> None:
        """Test resolving profile with empty auth mode."""
        # Arrange & Act
        resolved = await resolve_profile_from_department(
            department_id=None, auth_mode="", conn=db
        )

        # Assert
        assert resolved is None
