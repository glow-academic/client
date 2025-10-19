"""Schema queries - SQL query builders for database metadata operations."""

from typing import Any


class SchemaQueries:
    """Query builders for schema/metadata operations."""

    def list_schema_columns(self) -> tuple[str, list[Any]]:
        """Build query to list all tables and columns in the public schema.

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
        """
        return (query, [])
