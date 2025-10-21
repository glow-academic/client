"""Schema service layer - business logic for database metadata operations."""

import asyncpg  # type: ignore

from app.queries.schema_queries import SchemaQueries
from app.services.base_service import BaseService


class SchemaService(BaseService):
    """Service layer for schema/metadata operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = SchemaQueries()

    async def list_schema_columns(self) -> str:
        """Get formatted list of all tables and columns in the public schema.

        Returns:
            Formatted string with table.column data_type per line
        """
        try:
            query, params = self.queries.list_schema_columns()
            rows = await self.conn.fetch(query, *params)

            return "\n".join(
                f"{row['table_name']}.{row['column_name']} {row['data_type']}"
                for row in rows
            )
        except Exception as e:
            return f"Error retrieving schema: {str(e)}"


def get_schema_service(conn: asyncpg.Connection) -> SchemaService:
    """Get schema service instance."""
    return SchemaService(conn)
