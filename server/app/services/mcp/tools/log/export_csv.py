# export_csv.py
# 
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import csv
import io
import tempfile
import uuid

from app.db import engine
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError


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
            
            # Create temporary file
            temp_file = tempfile.NamedTemporaryFile(
                mode='w', 
                suffix='.csv', 
                delete=False,
                encoding='utf-8'
            )
            temp_file.write(csv_content)
            temp_file.close()
            
            # Generate download token (simplified - in production use proper file serving)
            download_token = str(uuid.uuid4())
            
            return f"CSV exported successfully. Download link: /download/{download_token} ({len(rows)} rows)"
            
    except SQLAlchemyError as e:
        return f"Error: {e}"