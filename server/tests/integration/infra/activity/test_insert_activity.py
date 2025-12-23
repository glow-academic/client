"""Integration tests for app.infra.v3.activity.insert."""

import asyncpg
import pytest
from app.infra.v3.activity.insert import insert_activity

pytestmark = pytest.mark.asyncio


class TestInsertActivity:
    """Tests for insert_activity function."""

    async def test_insert_activity_success(
        self, db: asyncpg.Connection
    ) -> None:
        """Test successful activity insertion."""
        # Arrange
        profile_id = await db.fetchval("SELECT id FROM profiles LIMIT 1")
        assert profile_id is not None

        # Act
        await insert_activity(
            message="Test activity message",
            endpoint="/api/v3/test",
            profile_id=str(profile_id),
            error=False,
            conn=db,
        )

        # Assert
        activity = await db.fetchrow(
            "SELECT * FROM activity WHERE message = $1 AND endpoint = $2",
            "Test activity message",
            "/api/v3/test",
        )
        assert activity is not None
        assert activity["message"] == "Test activity message"
        assert activity["endpoint"] == "/api/v3/test"
        assert activity["profile_id"] == profile_id
        assert activity["error"] is False

    async def test_insert_activity_with_error(
        self, db: asyncpg.Connection
    ) -> None:
        """Test activity insertion with error flag."""
        # Arrange
        profile_id = await db.fetchval("SELECT id FROM profiles LIMIT 1")
        assert profile_id is not None

        # Act
        await insert_activity(
            message="Error occurred",
            endpoint="/api/v3/test",
            profile_id=str(profile_id),
            error=True,
            conn=db,
        )

        # Assert
        activity = await db.fetchrow(
            "SELECT * FROM activity WHERE message = $1",
            "Error occurred",
        )
        assert activity is not None
        assert activity["error"] is True

    async def test_insert_activity_without_profile(
        self, db: asyncpg.Connection
    ) -> None:
        """Test activity insertion without profile_id."""
        # Arrange & Act
        await insert_activity(
            message="Anonymous activity",
            endpoint="/api/v3/test",
            profile_id=None,
            error=False,
            conn=db,
        )

        # Assert
        activity = await db.fetchrow(
            "SELECT * FROM activity WHERE message = $1",
            "Anonymous activity",
        )
        assert activity is not None
        assert activity["profile_id"] is None

    async def test_insert_activity_with_nonexistent_profile(
        self, db: asyncpg.Connection
    ) -> None:
        """Test activity insertion with nonexistent profile_id."""
        # Arrange
        fake_profile_id = "00000000-0000-0000-0000-000000000000"

        # Act
        await insert_activity(
            message="Activity with fake profile",
            endpoint="/api/v3/test",
            profile_id=fake_profile_id,
            error=False,
            conn=db,
        )

        # Assert
        activity = await db.fetchrow(
            "SELECT * FROM activity WHERE message = $1",
            "Activity with fake profile",
        )
        assert activity is not None
        # Profile ID should be NULL since profile doesn't exist
        assert activity["profile_id"] is None

