"""
Tests for app.services.mcp.tools.schema.query_data
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.schema.query_data import query_data
from sqlalchemy.exc import SQLAlchemyError


@patch("app.services.mcp.tools.schema.query_data.engine")
class TestQuery_Data:
    """Tests for query_data function."""

    def test_query_data_success(self, mock_engine):
        """Test successful query_data execution."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        # Mock query result
        mock_result = MagicMock()
        mock_result.fetchmany.return_value = [
            ("1", "Test User", "test@example.com"),
            ("2", "Another User", "another@example.com")
        ]
        mock_connection.execute.return_value = mock_result
        
        result = query_data("SELECT id, name, email FROM profiles LIMIT 2")
        
        assert "Test User" in result
        assert "Another User" in result
        assert "test@example.com" in result

    def test_query_data_error(self, mock_engine):
        """Test query_data error handling."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        mock_connection.execute.side_effect = SQLAlchemyError("Invalid SQL syntax")
        
        result = query_data("SELECT * FROM nonexistent_table")
        
        assert "Error:" in result
        assert "Invalid SQL syntax" in result

    def test_query_data_non_select_query(self, mock_engine):
        """Test query_data blocks non-SELECT queries."""
        result = query_data("INSERT INTO profiles (name) VALUES ('test')")
        
        assert "Error: only read-only queries are allowed." in result

    def test_query_data_update_query(self, mock_engine):
        """Test query_data blocks UPDATE queries."""
        result = query_data("UPDATE profiles SET name = 'test' WHERE id = 1")
        
        assert "Error: only read-only queries are allowed." in result

    def test_query_data_delete_query(self, mock_engine):
        """Test query_data blocks DELETE queries."""
        result = query_data("DELETE FROM profiles WHERE id = 1")
        
        assert "Error: only read-only queries are allowed." in result

    def test_query_data_drop_query(self, mock_engine):
        """Test query_data blocks DROP queries."""
        result = query_data("DROP TABLE profiles")
        
        assert "Error: only read-only queries are allowed." in result

    def test_query_data_empty_result(self, mock_engine):
        """Test query_data with empty result set."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        mock_result = MagicMock()
        mock_result.fetchmany.return_value = []
        mock_connection.execute.return_value = mock_result
        
        result = query_data("SELECT id, name FROM profiles WHERE id = 999")
        
        assert result == "(0 rows)"

    def test_query_data_single_column(self, mock_engine):
        """Test query_data with single column result."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        mock_result = MagicMock()
        mock_result.fetchmany.return_value = [
            ("User 1",),
            ("User 2",)
        ]
        mock_connection.execute.return_value = mock_result
        
        result = query_data("SELECT name FROM profiles")
        
        assert "User 1" in result
        assert "User 2" in result

    def test_query_data_complex_query(self, mock_engine):
        """Test query_data with complex SELECT query."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        mock_result = MagicMock()
        mock_result.fetchmany.return_value = [
            (5, 85.5)
        ]
        mock_connection.execute.return_value = mock_result
        
        result = query_data("SELECT COUNT(*) as count, AVG(score) as avg_score FROM grades")
        
        assert "5" in result
        assert "85.5" in result

    def test_query_data_with_join(self, mock_engine):
        """Test query_data with JOIN query."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        mock_result = MagicMock()
        mock_result.fetchmany.return_value = [
            ("John Doe", "Conflict Resolution")
        ]
        mock_connection.execute.return_value = mock_result
        
        result = query_data("SELECT p.first_name || ' ' || p.last_name as profile_name, s.title as simulation_title FROM profiles p JOIN simulation_attempts sa ON p.id = sa.profile_id JOIN simulations s ON sa.simulation_id = s.id")
        
        assert "John Doe" in result
        assert "Conflict Resolution" in result
