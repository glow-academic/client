"""Export query builders."""

from typing import Any


class ExportQueries:
    """Query builders for export operations."""

    def execute_select_query(self, sql: str) -> tuple[str, list[Any]]:
        """
        Pass through a SELECT query for execution.

        Args:
            sql: SELECT query to execute

        Returns:
            Tuple of (query, params) - params will be empty for raw SQL
        """
        # No params since this is a raw SQL query
        params: list[Any] = []
        return sql, params
