"""
Tests for app.utils.websocket.store_active_run
"""

from unittest.mock import MagicMock, patch

import pytest

from app.infra.v3.websocket.store_active_run import store_active_run


class TestStore_Active_Run:
    """Tests for store_active_run function."""

    @pytest.mark.asyncio
    async def test_store_active_run_success(self) -> None:
        """Test storing active run."""
        # Arrange
        chat_id = "chat-123"
        run_result = MagicMock()

        # Act
        with patch(
            "app.utils.websocket.store_active_run.set_active_run"
        ) as mock_set_active_run:
            await store_active_run(chat_id, run_result)

        # Assert
        mock_set_active_run.assert_called_once()
        # Verify that a UUID was generated and passed
        call_args = mock_set_active_run.call_args
        assert call_args[0][0] == chat_id
        assert isinstance(call_args[0][1], str)  # Should be a UUID string
