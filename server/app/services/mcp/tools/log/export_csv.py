# export_csv.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import csv
import io
import uuid

import asyncpg  # type: ignore
from app.extensions import CSV_FOLDER


async def export_csv(conn: asyncpg.Connection, sql: str) -> str:
    """Export query results as CSV download (SELECT only, 1000-row limit)."""
    lowered = sql.lstrip().lower()
    if not lowered.startswith("select"):
        return "Error: only SELECT queries are allowed for CSV export."

    try:
        # Execute query and fetch up to 1000 rows
        rows = await conn.fetch(sql)
        limited_rows = rows[:1000]  # Limit to 1000 rows for CSV export

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
