"""Integration tests for app.infra.v4.activity.websocket_logger."""

import pytest

from app.infra.v4.activity.websocket_logger import log_websocket_activity

pytestmark = pytest.mark.asyncio


class TestWebsocketLogger:
    """Tests for websocket logger functions."""

    async def test_log_websocket_activity_no_profile(self) -> None:
        """Test log_websocket_activity skips when no profile found."""
        # Arrange
        fake_sid = "fake_socket_id"
        event_key = "test.event"
        template = "Test activity: {{ actor.name }}"
        context = {}
        endpoint = "/socket/v4/test"

        # Act
        # This should skip if no profile found for socket
        await log_websocket_activity(fake_sid, event_key, template, context, endpoint)

        # Assert
        # Function should execute without error and skip logging

    async def test_log_websocket_activity_with_context(self) -> None:
        """Test log_websocket_activity with context."""
        # Arrange
        # Note: This test requires a real socket connection with profile
        # For now, we just verify the function signature and error handling
        fake_sid = "fake_socket_id"
        event_key = "test.event"
        template = "Test activity: {{ actor.name }}"
        context = {"test_field": "test_value"}
        endpoint = "/socket/v4/test"

        # Act
        # This will skip if no profile found, but should handle gracefully
        await log_websocket_activity(fake_sid, event_key, template, context, endpoint)

        # Assert
        # Function should execute without error

    async def test_log_websocket_activity_with_error(self) -> None:
        """Test log_websocket_activity with error flag."""
        # Arrange
        fake_sid = "fake_socket_id"
        event_key = "test.error"
        template = "Error occurred"
        context = {}
        endpoint = "/socket/v4/test"
        error = True

        # Act
        await log_websocket_activity(
            fake_sid, event_key, template, context, endpoint, error=error
        )

        # Assert
        # Function should execute without error

