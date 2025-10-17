# query_data.py

import asyncpg  # type: ignore


async def query_data(conn: asyncpg.Connection, sql: str) -> str:
    """Run SELECT or EXPLAIN queries with a 200-row limit (read-only)."""
    lowered = sql.lstrip().lower()
    if not lowered.startswith(("select", "explain")):
        return "Error: only read-only queries are allowed."

    try:
        # Fetch up to 200 rows
        rows = await conn.fetch(sql)
        limited_rows = rows[:200]
        
        # If there are rows, join them. Otherwise, return the "0 rows" message.
        if limited_rows:
            return "\n".join(str(dict(r)) for r in limited_rows)
        else:
            return "(0 rows)"
    except Exception as e:
        # Return a concise version of the error to the model.
        # The full error is still logged for developers.
        return f"Error: {e}"
