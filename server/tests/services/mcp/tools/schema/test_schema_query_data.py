"""
Tests for app.services.mcp.tools.schema.query_data
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.services.mcp.tools.schema.query_data import query_data


class TestQuery_Data:
    """Tests for query_data function."""

    @pytest.mark.asyncio
    @patch("app.services.mcp.tools.schema.query_data.get_pool")
    async def test_query_data_success(self, mock_get_pool: MagicMock) -> None:
        """Test successful query_data execution."""
        mock_conn = AsyncMock()
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        # Create mock records with dict-like behavior
        mock_record1 = {"id": "1", "name": "Test User", "email": "test@example.com"}
        mock_record2 = {"id": "2", "name": "Another User", "email": "another@example.com"}
        mock_conn.fetch.return_value = [mock_record1, mock_record2]

        result = await query_data("SELECT id, name, email FROM profiles LIMIT 2")

        assert "Test User" in result
        assert "Another User" in result
        assert "test@example.com" in result

    @pytest.mark.asyncio
    @patch("app.services.mcp.tools.schema.query_data.get_pool")
    async def test_query_data_error(self, mock_get_pool: MagicMock) -> None:
        """Test query_data error handling."""
        mock_conn = AsyncMock()
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        mock_conn.fetch.side_effect = Exception("Invalid SQL syntax")

        result = await query_data("SELECT * FROM nonexistent_table")

        assert "Error:" in result
        assert "Invalid SQL syntax" in result

    @pytest.mark.asyncio
    async def test_query_data_non_select_query(self) -> None:
        """Test query_data blocks non-SELECT queries."""
        result = await query_data("INSERT INTO profiles (name) VALUES ('test')")

        assert "Error: only read-only queries are allowed." in result

    @pytest.mark.asyncio
    async def test_query_data_update_query(self) -> None:
        """Test query_data blocks UPDATE queries."""
        result = await query_data("UPDATE profiles SET name = 'test' WHERE id = 1")

        assert "Error: only read-only queries are allowed." in result

    @pytest.mark.asyncio
    async def test_query_data_delete_query(self) -> None:
        """Test query_data blocks DELETE queries."""
        result = await query_data("DELETE FROM profiles WHERE id = 1")

        assert "Error: only read-only queries are allowed." in result

    @pytest.mark.asyncio
    async def test_query_data_drop_query(self) -> None:
        """Test query_data blocks DROP queries."""
        result = await query_data("DROP TABLE profiles")

        assert "Error: only read-only queries are allowed." in result

    @pytest.mark.asyncio
    @patch("app.services.mcp.tools.schema.query_data.get_pool")
    async def test_query_data_empty_result(self, mock_get_pool: MagicMock) -> None:
        """Test query_data with empty result set."""
        mock_conn = AsyncMock()
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        mock_conn.fetch.return_value = []

        result = await query_data("SELECT id, name FROM profiles WHERE id = 999")

        assert result == "(0 rows)"

    @pytest.mark.asyncio
    @patch("app.services.mcp.tools.schema.query_data.get_pool")
    async def test_query_data_single_column(self, mock_get_pool: MagicMock) -> None:
        """Test query_data with single column result."""
        mock_conn = AsyncMock()
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        mock_record1 = {"name": "User 1"}
        mock_record2 = {"name": "User 2"}
        mock_conn.fetch.return_value = [mock_record1, mock_record2]

        result = await query_data("SELECT name FROM profiles")

        assert "User 1" in result
        assert "User 2" in result

    @pytest.mark.asyncio
    @patch("app.services.mcp.tools.schema.query_data.get_pool")
    async def test_query_data_complex_query(self, mock_get_pool: MagicMock) -> None:
        """Test query_data with complex SELECT query."""
        mock_conn = AsyncMock()
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        mock_record = {"count": 5, "avg_score": 85.5}
        mock_conn.fetch.return_value = [mock_record]

        result = await query_data(
            "SELECT COUNT(*) as count, AVG(score) as avg_score FROM grades"
        )

        assert "5" in result
        assert "85.5" in result

    @pytest.mark.asyncio
    @patch("app.services.mcp.tools.schema.query_data.get_pool")
    async def test_query_data_with_join(self, mock_get_pool: MagicMock) -> None:
        """Test query_data with JOIN query."""
        mock_conn = AsyncMock()
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        mock_record = {"profile_name": "John Doe", "simulation_title": "Conflict Resolution"}
        mock_conn.fetch.return_value = [mock_record]

        result = await query_data(
            "SELECT p.first_name || ' ' || p.last_name as profile_name, s.title as simulation_title FROM profiles p JOIN attempt_profiles ap ON p.id = ap.profile_id JOIN simulation_attempts sa ON ap.attempt_id = sa.id JOIN simulations s ON sa.simulation_id = s.id"
        )

        assert "John Doe" in result
        assert "Conflict Resolution" in result
