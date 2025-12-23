"""Integration tests for app.infra.v3.activity.profile_exists."""

import asyncpg
import pytest
from app.infra.v3.activity.profile_exists import profile_exists

pytestmark = pytest.mark.asyncio


class TestProfileExists:
    """Tests for profile_exists function."""

    async def test_profile_exists_true(
        self, db: asyncpg.Connection
    ) -> None:
        """Test profile_exists returns True for existing profile."""
        # Arrange
        profile_id = await db.fetchval("SELECT id FROM profiles LIMIT 1")
        assert profile_id is not None

        # Act
        result = await profile_exists(str(profile_id), db)

        # Assert
        assert result is True

    async def test_profile_exists_false(
        self, db: asyncpg.Connection
    ) -> None:
        """Test profile_exists returns False for nonexistent profile."""
        # Arrange
        fake_profile_id = "00000000-0000-0000-0000-000000000000"

        # Act
        result = await profile_exists(fake_profile_id, db)

        # Assert
        assert result is False

    async def test_profile_exists_invalid_uuid(
        self, db: asyncpg.Connection
    ) -> None:
        """Test profile_exists returns False for invalid UUID."""
        # Arrange
        invalid_uuid = "not-a-valid-uuid"

        # Act
        result = await profile_exists(invalid_uuid, db)

        # Assert
        assert result is False

