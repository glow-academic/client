"""
Tests for app.utils.chat
"""

from typing import Any

import pytest
# Imports are done per-test to test individual functions


class TestGet_Simulation_Conversation_History:
    """Tests for get_simulation_conversation_history function."""

    def test_get_simulation_conversation_history_success(self) -> None:
        """Test successful get_simulation_conversation_history execution."""
        from datetime import datetime

        from app.utils.chat.get_simulation_conversation_history import get_simulation_conversation_history

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
        from datetime import datetime

        from app.utils.chat.get_simulation_conversation_history import get_simulation_conversation_history

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
        from datetime import datetime

        from app.utils.chat.get_simulation_conversation_history import get_simulation_conversation_history

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
        from app.utils.chat.get_simulation_conversation_history import get_simulation_conversation_history

        result = get_simulation_conversation_history([])

        assert result == []


class TestGet_Assistant_Conversation_History:
    """Tests for get_assistant_conversation_history function."""

    def test_get_assistant_conversation_history_success(self) -> None:
        """Test successful get_assistant_conversation_history execution."""
        from datetime import datetime

        from app.utils.chat.get_assistant_conversation_history import get_assistant_conversation_history

        messages = [
            {
                "role": "user",
                "content": "Hello",
                "created_at": datetime(2024, 1, 1, 10, 0, 0),
            },
            {
                "role": "assistant",
                "content": "Hi there!",
                "created_at": datetime(2024, 1, 1, 10, 0, 1),
            },
        ]
        tool_calls: list[dict[str, Any]] = []

        result = get_assistant_conversation_history(messages, tool_calls)

        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello"
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == "Hi there!"

    def test_get_assistant_conversation_history_with_tool_calls(self) -> None:
        """Test get_assistant_conversation_history with tool calls."""
        from datetime import datetime

        from app.utils.chat.get_assistant_conversation_history import get_assistant_conversation_history

        messages = [
            {
                "role": "user",
                "content": "Search for documents",
                "created_at": datetime(2024, 1, 1, 10, 0, 0),
            }
        ]
        tool_calls = [
            {
                "id": 123,
                "tool_name": "search_documents",
                "tool_arguments": '{"query": "test"}',
                "tool_result": '{"results": ["doc1", "doc2"]}',
                "created_at": datetime(2024, 1, 1, 10, 0, 1),
            }
        ]

        result = get_assistant_conversation_history(messages, tool_calls)

        # Should include user message, tool call, and tool output
        assert len(result) >= 3
        assert result[0]["role"] == "user"
        # Tool call and output should be in the result
        tool_items = [
            item
            for item in result
            if "type" in item and "function_call" in item["type"]
        ]
        assert len(tool_items) >= 1

    def test_get_assistant_conversation_history_empty(self) -> None:
        """Test with empty messages and tool calls."""
        from app.utils.chat.get_assistant_conversation_history import get_assistant_conversation_history

        result = get_assistant_conversation_history([], [])

        assert result == []

    def test_get_assistant_conversation_history_chronological_order(self) -> None:
        """Test that items are sorted chronologically."""
        from datetime import datetime

        from app.utils.chat.get_assistant_conversation_history import get_assistant_conversation_history

        messages = [
            {
                "role": "assistant",
                "content": "Second message",
                "created_at": datetime(2024, 1, 1, 10, 0, 2),
            },
            {
                "role": "user",
                "content": "First message",
                "created_at": datetime(2024, 1, 1, 10, 0, 0),
            },
        ]
        tool_calls: list[dict[str, Any]] = []

        result = get_assistant_conversation_history(messages, tool_calls)

        # Should be sorted chronologically
        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[1]["role"] == "assistant"


class TestFormat_Chat_Scenario:
    """Tests for format_chat_scenario function."""

    def test_format_chat_scenario_success(self) -> None:
        """Test successful format_chat_scenario execution."""
        from app.utils.chat.format_chat_scenario import format_chat_scenario

        problem_statement = "You are a customer service representative helping a user."

        result = format_chat_scenario(problem_statement)

        assert result["role"] == "user"
        assert "The following is the scenario for the chat:" in result["content"]
        assert problem_statement in result["content"]

    def test_format_chat_scenario_empty(self) -> None:
        """Test format_chat_scenario with empty string."""
        from app.utils.chat.format_chat_scenario import format_chat_scenario

        result = format_chat_scenario("")

        assert result["role"] == "user"
        assert "The following is the scenario for the chat:" in result["content"]
