"""Dynamic SQL bootstrap for integration tests.

Auto-discovers and executes all SQL views and query functions using the same
ordering logic as `make sql-compile`. Zero hardcoded file paths or SQL strings.
"""

import logging
import re
from pathlib import Path

import asyncpg  # type: ignore

from app.sql.compile_types import (
    VERSION,
    _sort_sql_files,
    execute_sql_file,
)

logger = logging.getLogger(__name__)

_SERVER_ROOT = Path(__file__).parent.parent
_DB_SCHEMA_DIR = _SERVER_ROOT.parent / "database" / "schema"


async def _bootstrap_views(conn: asyncpg.Connection, failures: list[tuple[str, str]]) -> int:
    """Bootstrap materialized views from database/schema/views/ (pure CREATE format).

    For each view file:
      1. Extract MV name from CREATE MATERIALIZED VIEW statement
      2. DROP MATERIALIZED VIEW IF EXISTS ... CASCADE
      3. Execute CREATE MATERIALIZED VIEW ... WITH NO DATA
      4. Execute matching index file from indexes/views/ (if exists)
      5. REFRESH MATERIALIZED VIEW

    Returns count of successfully created views.
    """
    views_dir = _DB_SCHEMA_DIR / "views"
    indexes_views_dir = _DB_SCHEMA_DIR / "indexes" / "views"

    if not views_dir.exists():
        return 0

    view_files = sorted(views_dir.glob("*.sql"))
    successes = 0

    for view_file in view_files:
        name = view_file.stem  # e.g. "activity_mv"
        sql = view_file.read_text()

        # Extract MV name from CREATE statement
        m = re.search(r"CREATE MATERIALIZED VIEW\s+(\w+)", sql, re.IGNORECASE)
        if not m:
            failures.append((str(view_file), "No CREATE MATERIALIZED VIEW found"))
            continue
        mv_name = m.group(1)

        try:
            # Drop existing MV (CASCADE drops its indexes too)
            await conn.execute(f"DROP MATERIALIZED VIEW IF EXISTS {mv_name} CASCADE")

            # Create MV
            await conn.execute(sql)

            # Apply indexes if file exists
            idx_file = indexes_views_dir / f"{name}.sql"
            if idx_file.exists():
                idx_sql = idx_file.read_text()
                # Execute each CREATE INDEX statement separately
                for stmt in re.split(r";\s*\n", idx_sql):
                    stmt = stmt.strip()
                    if stmt and stmt.upper().startswith("CREATE"):
                        await conn.execute(stmt + ";")

            # Refresh
            await conn.execute(f"REFRESH MATERIALIZED VIEW {mv_name}")
            successes += 1
        except Exception as e:
            failures.append((str(view_file.name), str(e)))

    return successes


async def _bootstrap_legacy_views(
    conn: asyncpg.Connection,
    failures: list[tuple[str, str]],
) -> int:
    """Fallback: bootstrap views from server/app/sql/views/ (old 6-step format)."""
    views_dir = _SERVER_ROOT / "app" / "sql" / VERSION / "views"
    if not views_dir.exists():
        return 0

    sql_files = list(views_dir.rglob("*.sql"))
    sql_files = [f for f in sql_files if "/views/NEW/" not in str(f)]
    sorted_files = sorted(sql_files, key=lambda f: _sort_sql_files(f, _SERVER_ROOT))

    successes = 0
    for sql_file in sorted_files:
        sql_path = str(sql_file.relative_to(_SERVER_ROOT))
        ok, msg = await execute_sql_file(sql_path, conn, _SERVER_ROOT)
        if ok:
            successes += 1
        else:
            failures.append((sql_path, msg))
    return successes


async def bootstrap_all_sql(conn: asyncpg.Connection) -> None:
    """Discover, sort, execute all SQL views + query functions, then refresh MVs.

    1. Create keycloak stubs
    2. Bootstrap MVs (prefer database/schema/views/, fallback to server/app/sql/views/)
    3. Discover and execute query functions (*_complete.sql)
    4. Auto-refresh any unpopulated MVs
    5. Log summary
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

    # --- Views ---
    views_dir = _DB_SCHEMA_DIR / "views"
    if views_dir.exists() and any(views_dir.glob("*.sql")):
        view_count = await _bootstrap_views(conn, failures)
        logger.info("bootstrap_all_sql: %d views created (pure CREATE format)", view_count)
    else:
        view_count = await _bootstrap_legacy_views(conn, failures)
        logger.info("bootstrap_all_sql: %d views created (legacy 6-step format)", view_count)

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

    # Auto-refresh any unpopulated materialized views
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
        "bootstrap_all_sql: %d views, %d queries succeeded, %d total failures",
        view_count,
        query_successes,
        len(failures),
    )
    if failures:
        for path, msg in failures:
            logger.warning("  FAILED: %s — %s", path, msg)
