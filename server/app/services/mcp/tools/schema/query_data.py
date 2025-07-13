# query_data.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from app.db import engine
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError


def query_data(sql: str) -> str:
    """
    🔎 Custom SQL queries (read-only)
    ---------------------------------
    Run SELECT/EXPLAIN queries with 200-row limit.

    Input
      • sql – SELECT or EXPLAIN statement only

    Returns
      Raw query results as text

    Quick-start
      ask:  "Run this SQL: SELECT * FROM profiles LIMIT 5"
      call: query_data("SELECT first_name, last_name FROM profiles LIMIT 5")

    Security: Only SELECT and EXPLAIN allowed.
    """
    lowered = sql.lstrip().lower()
    if not lowered.startswith(("select", "explain")):
        return "Error: only read-only queries are allowed."

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = result.fetchmany(200)
            return "\n".join(str(r) for r in rows) or "↩️ (0 rows)"
    except SQLAlchemyError as e:
        return f"Error: {e}"
