"""
Tests for app.services.mcp.tools.schema.query_data
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.schema.query_data import query_data
from sqlalchemy.exc import SQLAlchemyError


@patch("app.services.mcp.tools.schema.query_data.get_session")
class TestQuery_Data:
    """Tests for query_data function."""

    def test_query_data_success(self, mock_get_session):
        """Test successful query_data execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        # Mock query result
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            {"id": 1, "name": "Test User", "email": "test@example.com"},
            {"id": 2, "name": "Another User", "email": "another@example.com"}
        ]
        mock_result.keys.return_value = ["id", "name", "email"]
        
        mock_session.exec.return_value = mock_result
        
        result = query_data("SELECT id, name, email FROM profiles LIMIT 2")
        
        assert result["success"] is True
        assert "data" in result
        assert len(result["data"]) == 2
        assert result["data"][0]["id"] == 1
        assert result["data"][0]["name"] == "Test User"
        assert result["data"][1]["id"] == 2
        assert result["data"][1]["name"] == "Another User"

    def test_query_data_error(self, mock_get_session):
        """Test query_data error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        mock_session.exec.side_effect = SQLAlchemyError("Invalid SQL syntax")
        
        result = query_data("SELECT * FROM nonexistent_table")
        
        assert result["success"] is False
        assert "error" in result
        assert "Database error" in result["error"]

    def test_query_data_non_select_query(self, mock_get_session):
        """Test query_data blocks non-SELECT queries."""
        result = query_data("INSERT INTO profiles (name) VALUES ('test')")
        
        assert result["success"] is False
        assert "error" in result
        assert "Only SELECT queries are allowed" in result["error"]

    def test_query_data_update_query(self, mock_get_session):
        """Test query_data blocks UPDATE queries."""
        result = query_data("UPDATE profiles SET name = 'test' WHERE id = 1")
        
        assert result["success"] is False
        assert "error" in result
        assert "Only SELECT queries are allowed" in result["error"]

    def test_query_data_delete_query(self, mock_get_session):
        """Test query_data blocks DELETE queries."""
        result = query_data("DELETE FROM profiles WHERE id = 1")
        
        assert result["success"] is False
        assert "error" in result
        assert "Only SELECT queries are allowed" in result["error"]

    def test_query_data_drop_query(self, mock_get_session):
        """Test query_data blocks DROP queries."""
        result = query_data("DROP TABLE profiles")
        
        assert result["success"] is False
        assert "error" in result
        assert "Only SELECT queries are allowed" in result["error"]

    def test_query_data_empty_result(self, mock_get_session):
        """Test query_data with empty result set."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_result.keys.return_value = ["id", "name"]
        
        mock_session.exec.return_value = mock_result
        
        result = query_data("SELECT id, name FROM profiles WHERE id = 999")
        
        assert result["success"] is True
        assert "data" in result
        assert result["data"] == []

    def test_query_data_single_column(self, mock_get_session):
        """Test query_data with single column result."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            {"name": "User 1"},
            {"name": "User 2"}
        ]
        mock_result.keys.return_value = ["name"]
        
        mock_session.exec.return_value = mock_result
        
        result = query_data("SELECT name FROM profiles")
        
        assert result["success"] is True
        assert len(result["data"]) == 2
        assert result["data"][0]["name"] == "User 1"
        assert result["data"][1]["name"] == "User 2"

    def test_query_data_complex_query(self, mock_get_session):
        """Test query_data with complex SELECT query."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            {"count": 5, "avg_score": 85.5}
        ]
        mock_result.keys.return_value = ["count", "avg_score"]
        
        mock_session.exec.return_value = mock_result
        
        result = query_data("SELECT COUNT(*) as count, AVG(score) as avg_score FROM grades")
        
        assert result["success"] is True
        assert len(result["data"]) == 1
        assert result["data"][0]["count"] == 5
        assert result["data"][0]["avg_score"] == 85.5

    def test_query_data_with_join(self, mock_get_session):
        """Test query_data with JOIN query."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            {"profile_name": "John Doe", "simulation_title": "Conflict Resolution"}
        ]
        mock_result.keys.return_value = ["profile_name", "simulation_title"]
        
        mock_session.exec.return_value = mock_result
        
        result = query_data("SELECT p.first_name || ' ' || p.last_name as profile_name, s.title as simulation_title FROM profiles p JOIN simulation_attempts sa ON p.id = sa.profile_id JOIN simulations s ON sa.simulation_id = s.id")
        
        assert result["success"] is True
        assert len(result["data"]) == 1
        assert result["data"][0]["profile_name"] == "John Doe"
        assert result["data"][0]["simulation_title"] == "Conflict Resolution"
