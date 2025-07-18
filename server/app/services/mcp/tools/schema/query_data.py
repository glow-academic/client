# query_data.py

from app.db import engine
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError


def query_data(sql: str) -> str:
    """
    Custom SQL queries (read-only)
    Run SELECT or EXPLAIN queries with a 200-row limit.
    All standard SELECT clauses like WHERE, LIKE, JOIN, GROUP BY, ORDER BY are supported.

    Input
      • sql - A standard SQL SELECT or EXPLAIN statement.

    Returns
      Raw query results as text, or an error message.

    Quick-start
      ask:  "Run this SQL: SELECT * FROM profiles LIMIT 5"
      call: query_data("SELECT first_name, last_name FROM profiles LIMIT 5")

    Troubleshooting
      • If you get a "no such column" or "no such table" error, your query is likely using an incorrect name.
      • **Fallback:** Call the `list_schema()` tool first to see the available tables and exact column names before trying your query again.

    Security
      • Only SELECT and EXPLAIN statements are allowed.
      • UPDATE, INSERT, DELETE, and other write operations are blocked.
    """
    lowered = sql.lstrip().lower()
    if not lowered.startswith(("select", "explain")):
        return "Error: only read-only queries are allowed."

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = result.fetchmany(200)
            # If there are rows, join them. Otherwise, return the "0 rows" message.
            if rows:
                return "\n".join(str(r) for r in rows)
            else:
                return "(0 rows)"
    except SQLAlchemyError as e:
        # Return a concise version of the error to the model.
        # The full error is still logged for developers.
        return f"Error: {e}"
