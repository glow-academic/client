# db_server.py  –  Postgres MCP server
from app.db import engine
from mcp.server.fastmcp import FastMCP
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

# Configure for stateless HTTP transport
db_server = FastMCP("Postgres-DB", stateless_http=True)


@db_server.resource("schema://public")
def list_schema() -> str:
    """Return every table + column in the public schema."""
    sql = """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """
    with engine.connect() as conn:
        rows = conn.execute(text(sql))
        return "\n".join(f"{t}.{c} {d}" for t, c, d in rows)

@db_server.tool()
def query_data(sql: str) -> str:
    """
    Run *read-only* queries.  Reject anything that isn't SELECT/EXPLAIN.
    Usage limits (e.g. row cap) keep the response small enough for the LLM.
    """
    lowered = sql.lstrip().lower()
    if not lowered.startswith(("select", "explain")):
        return "Error: only read-only queries are allowed."

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows   = result.fetchmany(200)          # cap output
            return "\n".join(str(r) for r in rows) or "↩️ (0 rows)"
    except SQLAlchemyError as e:
        return f"Error: {e}"
