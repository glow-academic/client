"""Integration tests for app.infra.v4.activity.profile_exists."""

import asyncpg
import pytest
from tests.sql.types import (
    CreateTestProfileSqlParams,
    CreateTestProfileSqlRow,
)

from app.infra.v4.activity.profile_exists import profile_exists
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


class TestProfileExists:
    """Tests for profile_exists function."""

    async def test_profile_exists_true(self, db: asyncpg.Connection) -> None:
        """Test profile_exists returns True for existing profile."""
        # Arrange
        result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/api/profile/test_create_test_profile_v4_complete.sql",
            params=CreateTestProfileSqlParams(
                profile_first_name="Test",
                profile_last_name="User",
                profile_role="guest",
                profile_active=True,
            ),
        )
        typed_result = CreateTestProfileSqlRow.model_validate(result.model_dump())
        profile_id = typed_result.profile_id
        assert profile_id is not None

        # Act
        result = await profile_exists(str(profile_id), db)

        # Assert
        assert result is True

    async def test_profile_exists_false(self, db: asyncpg.Connection) -> None:
        """Test profile_exists returns False for nonexistent profile."""
        # Arrange
        fake_profile_id = "00000000-0000-0000-0000-000000000000"

        # Act
        result = await profile_exists(fake_profile_id, db)

        # Assert
        assert result is False

    async def test_profile_exists_invalid_uuid(self, db: asyncpg.Connection) -> None:
        """Test profile_exists returns False for invalid UUID."""
        # Arrange
        invalid_uuid = "not-a-valid-uuid"

        # Act
        result = await profile_exists(invalid_uuid, db)

        # Assert
        assert result is False
