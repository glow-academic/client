"""Integration tests for app.infra.v3.activity.insert_websocket."""

import asyncpg
import pytest
from app.infra.v3.activity.insert_websocket import insert_activity_websocket

pytestmark = pytest.mark.asyncio


class TestInsertActivityWebsocket:
    """Tests for insert_activity_websocket function."""

    async def test_insert_activity_websocket_success(
        self, db: asyncpg.Connection
    ) -> None:
        """Test successful websocket activity insertion."""
        # Arrange
        profile_id = await db.fetchval(
            "INSERT INTO profiles(first_name, last_name, role, active) "
            "VALUES ('Test', 'User', 'member', true) RETURNING id"
        )
        assert profile_id is not None

        # Act
        await insert_activity_websocket(
            message="WebSocket event occurred",
            endpoint="/socket/v3/test",
            profile_id=str(profile_id),
            error=False,
            conn=db,
        )

        # Assert
        activity = await db.fetchrow(
            "SELECT * FROM activity WHERE message = $1 AND endpoint = $2",
            "WebSocket event occurred",
            "/socket/v3/test",
        )
        assert activity is not None
        assert activity["message"] == "WebSocket event occurred"
        assert activity["endpoint"] == "/socket/v3/test"
        assert activity["profile_id"] == profile_id
        assert activity["error"] is False

    async def test_insert_activity_websocket_with_error(
        self, db: asyncpg.Connection
    ) -> None:
        """Test websocket activity insertion with error flag."""
        # Arrange
        profile_id = await db.fetchval(
            "INSERT INTO profiles(first_name, last_name, role, active) "
            "VALUES ('Test', 'User', 'member', true) RETURNING id"
        )
        assert profile_id is not None

        # Act
        await insert_activity_websocket(
            message="WebSocket error",
            endpoint="/socket/v3/test",
            profile_id=str(profile_id),
            error=True,
            conn=db,
        )

        # Assert
        activity = await db.fetchrow(
            "SELECT * FROM activity WHERE message = $1",
            "WebSocket error",
        )
        assert activity is not None
        assert activity["error"] is True

    async def test_insert_activity_websocket_without_profile(
        self, db: asyncpg.Connection
    ) -> None:
        """Test websocket activity insertion without profile_id."""
        # Arrange & Act
        await insert_activity_websocket(
            message="Anonymous websocket activity",
            endpoint="/socket/v3/test",
            profile_id=None,
            error=False,
            conn=db,
        )

        # Assert
        activity = await db.fetchrow(
            "SELECT * FROM activity WHERE message = $1",
            "Anonymous websocket activity",
        )
        assert activity is not None
        assert activity["profile_id"] is None

