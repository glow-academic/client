# export_csv.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import csv
import io
import uuid

from app.db import engine
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import CSV_FOLDER


def export_csv(sql: str) -> str:
    """
    🔎 Export query results as CSV download
    ---------------------------------------
    Same guard-rails as query_data but returns a downloadable CSV link.

    Input
      • sql – SELECT statement only

    Returns
      Download link for CSV file

    Quick-start
      ask:  "Export roster for Cohort C"
      call: export_csv("SELECT first_name, last_name FROM profiles WHERE ...")

    Security: Only SELECT allowed, 1000-row limit.
    """
    lowered = sql.lstrip().lower()
    if not lowered.startswith("select"):
        return "Error: only SELECT queries are allowed for CSV export."

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = result.fetchmany(1000)  # Limit to 1000 rows for CSV export

            if not rows:
                return "No data to export."

            # Create CSV content
            output = io.StringIO()
            writer = csv.writer(output)

            # Write header
            if rows:
                writer.writerow(rows[0].keys())

            # Write data rows
            for row in rows:
                writer.writerow(row)

            csv_content = output.getvalue()
            output.close()

            # Generate download token
            download_token = str(uuid.uuid4())
            csv_path = CSV_FOLDER / f"{download_token}.csv"

            # Write CSV file to CSV_FOLDER/token.csv
            with open(csv_path, "w", encoding="utf-8") as f:
                f.write(csv_content)

            return f"CSV exported successfully. Download token: {download_token} ({len(rows)} rows)"

    except SQLAlchemyError as e:
        return f"Error: {e}"
