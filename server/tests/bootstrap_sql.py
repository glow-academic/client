"""Dynamic SQL bootstrap for integration tests.

Auto-discovers and executes all SQL query functions using the same
ordering logic as `make sql-compile`. Materialized views are loaded
as part of the schema (via _concat_schema in conftest.py).
"""

import logging
from pathlib import Path

import asyncpg  # type: ignore

from app.sql.compile_types import (
    VERSION,
    _sort_sql_files,
    execute_sql_file,
)

logger = logging.getLogger(__name__)

_SERVER_ROOT = Path(__file__).parent.parent


async def bootstrap_all_sql(conn: asyncpg.Connection) -> None:
    """Discover, sort, execute all SQL query functions, then refresh MVs.

    1. Create keycloak stubs
    2. Discover and execute query functions (*_complete.sql)
    3. Refresh all unpopulated MVs (created WITH NO DATA by schema load)
    4. Log summary
    """
    # Keycloak stub tables — the real tables are created by Keycloak at startup,
    # but the test DB never runs Keycloak.  These minimal stubs let SQL functions
    # that reference keycloak.org / keycloak.realm compile without error.
    await conn.execute("""
        CREATE SCHEMA IF NOT EXISTS keycloak;
        CREATE TABLE IF NOT EXISTS keycloak.org (
            id text PRIMARY KEY,
            alias text
        );
        CREATE TABLE IF NOT EXISTS keycloak.realm (
            name text PRIMARY KEY,
            ssl_required text
        );
    """)

    failures: list[tuple[str, str]] = []

    # --- Query functions ---
    queries_dir = _SERVER_ROOT / "app" / "sql" / VERSION / "queries"
    query_files: list[Path] = []
    if queries_dir.exists():
        query_files = list(queries_dir.rglob("*_complete.sql"))

    sorted_queries = sorted(query_files, key=lambda f: _sort_sql_files(f, _SERVER_ROOT))

    query_successes = 0
    for sql_file in sorted_queries:
        sql_path = str(sql_file.relative_to(_SERVER_ROOT))
        ok, msg = await execute_sql_file(sql_path, conn, _SERVER_ROOT)
        if ok:
            query_successes += 1
        else:
            failures.append((sql_path, msg))

    # Refresh all unpopulated materialized views
    # (MVs are created WITH NO DATA by schema load, need initial refresh)
    unpopulated = await conn.fetch(
        "SELECT matviewname FROM pg_matviews WHERE NOT ispopulated"
    )
    for row in unpopulated:
        mv_name = row["matviewname"]
        try:
            await conn.execute(f'REFRESH MATERIALIZED VIEW "{mv_name}"')
        except Exception as e:
            failures.append((f"REFRESH {mv_name}", str(e)))

    # Log summary
    logger.info(
        "bootstrap_all_sql: %d queries succeeded, %d failures",
        query_successes,
        len(failures),
    )
    if failures:
        for path, msg in failures:
            logger.warning("  FAILED: %s — %s", path, msg)
