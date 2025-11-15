"""
Tests for app.utils.chat.get_simulation_conversation_history
"""

from datetime import datetime

import pytest
from app.utils.chat.get_simulation_conversation_history import get_simulation_conversation_history


class TestGet_Simulation_Conversation_History:
    """Tests for get_simulation_conversation_history function."""

    def test_get_simulation_conversation_history_success(self) -> None:
        """Test successful get_simulation_conversation_history execution."""
        messages = [
            {
                "type": "query",
                "content": "Hello",
                "created_at": datetime(2024, 1, 1, 10, 0, 0),
            },
            {
                "type": "response",
                "content": "Hi there!",
                "created_at": datetime(2024, 1, 1, 10, 0, 1),
            },
        ]

        result = get_simulation_conversation_history(messages)

        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello"
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == "Hi there!"

    def test_get_simulation_conversation_history_filters_errors(self) -> None:
        """Test that error messages are filtered out."""
        messages = [
            {
                "type": "query",
                "content": "Hello",
                "created_at": datetime(2024, 1, 1, 10, 0, 0),
            },
            {
                "type": "response",
                "content": "Error: Something went wrong",
                "created_at": datetime(2024, 1, 1, 10, 0, 1),
            },
        ]

        result = get_simulation_conversation_history(messages)

        # Error message should be filtered out
        assert len(result) == 1
        assert result[0]["content"] == "Hello"

    def test_get_simulation_conversation_history_consecutive_responses(self) -> None:
        """Test handling of consecutive response messages."""
        messages = [
            {
                "type": "query",
                "content": "Hello",
                "created_at": datetime(2024, 1, 1, 10, 0, 0),
            },
            {
                "type": "response",
                "content": "First response",
                "created_at": datetime(2024, 1, 1, 10, 0, 1),
            },
            {
                "type": "response",
                "content": "Second response",
                "created_at": datetime(2024, 1, 1, 10, 0, 2),
            },
        ]

        result = get_simulation_conversation_history(messages)

        # Should only keep the latest response
        assert len(result) == 2
        assert result[1]["content"] == "Second response"

    def test_get_simulation_conversation_history_empty(self) -> None:
        """Test with empty messages list."""
        result = get_simulation_conversation_history([])

        assert result == []

