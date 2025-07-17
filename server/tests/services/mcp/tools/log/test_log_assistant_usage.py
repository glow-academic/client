# tests/services/mcp/tools/log/test_assistant_usage.py

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.log.assistant_usage import assistant_usage

# Mock data classes to simulate SQLModel objects
class MockProfile:
    def __init__(self, id, first_name, last_name, alias, role="admin"):
        self.id, self.first_name, self.last_name, self.alias, self.role = id, first_name, last_name, alias, role

class MockAssistantChat:
    def __init__(self, id, profile_id, created_at):
        self.id, self.profile_id, self.created_at = id, profile_id, created_at

class MockAssistantMessage:
    def __init__(self, chat_id, created_at, completed=True):
        self.id, self.chat_id, self.created_at, self.completed = uuid.uuid4(), chat_id, created_at, completed

class MockAssistantToolCall:
    def __init__(self, chat_id, tool_name, created_at, completed=True):
        self.id, self.chat_id, self.tool_name, self.created_at, self.completed = uuid.uuid4(), chat_id, tool_name, created_at, completed


@patch("app.services.mcp.tools.log.assistant_usage.get_session")
class TestAssistant_Usage:
    """Tests for the assistant_usage function."""

    def test_assistant_usage_success(self, mock_get_session):
        """Test successful execution with a variety of data."""
        # Arrange
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        user1_id, user2_id = uuid.uuid4(), uuid.uuid4()
        chat1_id, chat2_id = uuid.uuid4(), uuid.uuid4()
        now = datetime.now()

        # Mock data to be returned by the database
        mock_chats = [
            MockAssistantChat(chat1_id, user1_id, now - timedelta(days=1)),
            MockAssistantChat(chat2_id, user2_id, now - timedelta(days=2)),
        ]
        mock_messages = [
            MockAssistantMessage(chat1_id, now - timedelta(days=1)),
            MockAssistantMessage(chat1_id, now - timedelta(days=1)),
            MockAssistantMessage(chat2_id, now - timedelta(days=2)),
        ]
        mock_tool_calls = [
            MockAssistantToolCall(chat1_id, "_find_profiles", now - timedelta(days=1)),
            MockAssistantToolCall(chat1_id, "_student_sim_report", now - timedelta(days=1)),
            MockAssistantToolCall(chat2_id, "_find_profiles", now - timedelta(days=2)),
        ]
        mock_profiles = [
            MockProfile(user1_id, "John", "Doe", "jdoe"),
            MockProfile(user2_id, "Jane", "Smith", "jsmith"),
        ]

        # Configure the mock session's return values
        mock_session.exec.return_value.all.side_effect = [mock_chats, mock_messages, mock_tool_calls]
        mock_session.get.side_effect = lambda model, profile_id: next(p for p in mock_profiles if p.id == profile_id)

        # Act
        result = assistant_usage(days=3)

        # Assert
        assert "error" not in result
        summary = result["summary"]
        assert summary["total_chats"] == 2
        assert summary["total_messages"] == 3
        assert summary["total_tool_calls"] == 3
        assert summary["unique_users"] == 2
        assert summary["avg_messages_per_chat"] == 1.5

        assert len(result["daily_stats"]) == 3
        assert result["daily_stats"][1]["chats"] == 1 # Chat from 2 days ago

        assert len(result["top_users"]) == 2
        assert result["top_users"][0]["name"] == "John Doe"
        
        assert len(result["tool_usage"]) == 2
        assert result["tool_usage"][0]["tool_name"] == "_find_profiles"
        assert result["tool_usage"][0]["usage_count"] == 2

    def test_assistant_usage_no_data(self, mock_get_session):
        """Test graceful handling of a period with no usage."""
        # Arrange
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.return_value.all.return_value = [] # Return empty lists for all DB queries

        # Act
        result = assistant_usage(days=7)

        # Assert
        assert "error" not in result
        summary = result["summary"]
        assert summary["total_chats"] == 0
        assert summary["unique_users"] == 0
        assert summary["avg_chats_per_day"] == 0
        assert len(result["top_users"]) == 0
        assert len(result["tool_usage"]) == 0

    def test_assistant_usage_error(self, mock_get_session):
        """Test that a database error is handled correctly."""
        # Arrange
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.side_effect = SQLAlchemyError("DB connection lost")

        # Act
        result = assistant_usage(days=7)

        # Assert
        assert result == {"error": "Database error: DB connection lost"}