"""Export service with business logic for data export operations."""

import csv
import io
import uuid

import asyncpg  # type: ignore

from app.extensions import CSV_FOLDER
from app.queries.export_queries import ExportQueries
from app.services.base import BaseService


class ExportService(BaseService):
    """Service for export operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = ExportQueries()

    async def export_to_csv(self, sql: str, max_rows: int = 1000) -> str:
        """
        Export query results to CSV file.

        Args:
            sql: SQL query to execute (SELECT only)
            max_rows: Maximum number of rows to export (default 1000)

        Returns:
            Success message with download token or error message
        """
        # Validate SELECT-only query
        lowered = sql.lstrip().lower()
        if not lowered.startswith("select"):
            return "Error: only SELECT queries are allowed for CSV export."

        try:
            # Execute query
            query, params = self.queries.execute_select_query(sql)
            rows = await self.conn.fetch(query, *params)

            # Limit rows
            limited_rows = rows[:max_rows]

            if not limited_rows:
                return "No data to export."

            # Get column names from the first row
            header = limited_rows[0].keys()

            # Create CSV content
            output = io.StringIO()
            writer = csv.writer(output)

            # Write header
            writer.writerow(header)

            # Write data rows
            for row in limited_rows:
                writer.writerow(tuple(row.values()))

            csv_content = output.getvalue()
            output.close()

            # Generate download token
            download_token = str(uuid.uuid4())
            csv_path = CSV_FOLDER / f"{download_token}.csv"

            # Write CSV file to CSV_FOLDER/token.csv
            with open(csv_path, "w", encoding="utf-8") as f:
                f.write(csv_content)

            return f"CSV exported successfully. Download token: {download_token} ({len(limited_rows)} rows)"

        except Exception as e:
            return f"Error: {e}"


def get_export_service(conn: asyncpg.Connection) -> ExportService:
    """Get export service instance."""
    return ExportService(conn)
