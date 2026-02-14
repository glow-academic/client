"""Dynamic SQL bootstrap for integration tests.

Auto-discovers and executes all SQL views and query functions using the same
ordering logic as `make sql-compile`. Zero hardcoded file paths or SQL strings.
"""

import logging
from pathlib import Path

import asyncpg  # type: ignore

from app.infra.v4.sql.compile_types import (
    VERSION,
    _sort_sql_files,
    execute_sql_file,
)

logger = logging.getLogger(__name__)

_SERVER_ROOT = Path(__file__).parent.parent


async def bootstrap_all_sql(conn: asyncpg.Connection) -> None:
    """Discover, sort, execute all SQL views + query functions, then refresh MVs.

    1. Auto-discover: rglob("*.sql") in views/, rglob("*_complete.sql") in queries/
    2. Sort: _sort_sql_files() — single source of truth for dependency ordering
    3. Execute: execute_sql_file() — handles function/view detection
    4. Auto-refresh unpopulated MVs via pg_matviews catalog
    5. Log summary of successes/failures
    """
    views_dir = _SERVER_ROOT / "app" / "sql" / VERSION / "views"
    queries_dir = _SERVER_ROOT / "app" / "sql" / VERSION / "queries"

    sql_files: list[Path] = []

    # Discover view SQL files
    if views_dir.exists():
        sql_files.extend(views_dir.rglob("*.sql"))

    # Discover query SQL files (only *_complete.sql — these contain functions)
    if queries_dir.exists():
        sql_files.extend(queries_dir.rglob("*_complete.sql"))

    # Exclude work-in-progress views
    sql_files = [f for f in sql_files if "/views/NEW/" not in str(f)]

    if not sql_files:
        logger.warning("bootstrap_all_sql: no SQL files found")
        return

    # Sort using the same ordering as sql-compile
    sorted_files = sorted(sql_files, key=lambda f: _sort_sql_files(f, _SERVER_ROOT))

    successes: list[str] = []
    failures: list[tuple[str, str]] = []

    for sql_file in sorted_files:
        sql_path = str(sql_file.relative_to(_SERVER_ROOT))
        ok, msg = await execute_sql_file(sql_path, conn, _SERVER_ROOT)
        if ok:
            successes.append(sql_path)
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
        "bootstrap_all_sql: %d succeeded, %d failed out of %d files",
        len(successes),
        len(failures),
        len(sorted_files),
    )
    if failures:
        for path, msg in failures:
            logger.warning("  FAILED: %s — %s", path, msg)
