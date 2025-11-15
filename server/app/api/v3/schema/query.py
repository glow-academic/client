"""Schema query endpoint - v3 API."""


from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import get_pool, server

router = APIRouter()


class QueryDataRequest(BaseModel):
    """Request to execute a SQL query."""

    sql: str


@router.post("/query")
@server.tool()
async def query_data(
    request: QueryDataRequest,
) -> str:
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
    lowered = request.sql.lstrip().lower()
    if not lowered.startswith(("select", "explain")):
        raise HTTPException(
            status_code=400, detail="Error: only read-only queries are allowed."
        )

    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            # Fetch up to 200 rows
            rows = await conn.fetch(request.sql)
            limited_rows = rows[:200]

            # If there are rows, join them. Otherwise, return the "0 rows" message.
            if limited_rows:
                return "\n".join(str(dict(r)) for r in limited_rows)
            else:
                return "(0 rows)"
    except Exception as e:
        # Return a concise version of the error to the model.
        # The full error is still logged for developers.
        return f"Error: {str(e)}"
