# tests/services/mcp/tools/schema/test_list_schema.py

from unittest.mock import AsyncMock, patch

import pytest
from app.mcp.tools.schema.list_schema import list_schema


class TestList_Schema:
    """Unit tests for the list_schema function."""

    @pytest.mark.asyncio
    @patch("app.mcp.tools.schema.list_schema.get_pool")
    async def test_list_schema_success(self, mock_get_pool: AsyncMock) -> None:
        """Tests that list_schema correctly formats the output from the DB."""
        mock_conn = AsyncMock()
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        # Create mock records with dict-like behavior
        mock_record1 = {"table_name": "profiles", "column_name": "id", "data_type": "uuid"}
        mock_record2 = {"table_name": "profiles", "column_name": "first_name", "data_type": "text"}
        mock_record3 = {"table_name": "agents", "column_name": "id", "data_type": "uuid"}
        mock_conn.fetch.return_value = [mock_record1, mock_record2, mock_record3]

        # Act
        result = await list_schema()

        # Assert
        expected_output = "profiles.id uuid\nprofiles.first_name text\nagents.id uuid"
        assert result == expected_output
        mock_conn.fetch.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.mcp.tools.schema.list_schema.get_pool")
    async def test_list_schema_error(self, mock_get_pool: AsyncMock) -> None:
        """Tests that list_schema raises an error if the DB connection fails."""
        mock_conn = AsyncMock()
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        mock_conn.fetch.side_effect = Exception("Connection failed")

        # Act & Assert: The function itself doesn't catch the error, so we
        # expect the test to raise the same error.
        with pytest.raises(Exception, match="Connection failed"):
            await list_schema()
