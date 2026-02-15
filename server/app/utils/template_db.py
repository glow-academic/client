"""Template database management for fast integration tests.

Instead of rebuilding schema + seed + SQL functions every run,
we save a fully-bootstrapped database as a Postgres template and
clone it on subsequent runs. A content hash of all input files
invalidates the template when anything changes.
"""

import hashlib
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import asyncpg  # type: ignore[import]


def compute_db_hash(database_dir: Path, sql_dir: Path) -> str:
    """SHA-256 of schema.sql + test-seed.sql + all SQL files (sorted by path).

    Returns the first 16 hex chars — enough for uniqueness while keeping
    template names readable.
    """
    h = hashlib.sha256()

    # Hash the two large seed files first
    for name in ("schema.sql", "test-seed.sql"):
        p = database_dir / name
        if p.exists():
            h.update(p.read_bytes())

    # Hash every SQL file under the sql directory (deterministic order)
    sql_files = sorted(sql_dir.rglob("*.sql"))
    for f in sql_files:
        # Include relative path so renames invalidate the hash
        h.update(str(f.relative_to(sql_dir)).encode())
        h.update(f.read_bytes())

    return h.hexdigest()[:16]


def get_admin_url(test_db_url: str) -> str:
    """Derive a connection URL to the ``postgres`` admin database.

    The admin DB is needed for ``CREATE DATABASE … TEMPLATE`` because you
    cannot run DDL that creates databases while connected to the target.
    """
    parsed = urlparse(test_db_url)
    # Replace the path (database name) with /postgres
    return urlunparse(parsed._replace(path="/postgres"))


async def template_exists(admin_conn: asyncpg.Connection, template_name: str) -> bool:
    """Check whether *template_name* exists in ``pg_database``."""
    row = await admin_conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1", template_name
    )
    return row is not None


async def clone_from_template(
    admin_conn: asyncpg.Connection, template_name: str, target_db: str
) -> None:
    """``CREATE DATABASE target TEMPLATE template_name``."""
    # DROP if leftover from a previous crashed run
    existing = await admin_conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1", target_db
    )
    if existing:
        await admin_conn.execute(f'DROP DATABASE "{target_db}"')

    await admin_conn.execute(
        f'CREATE DATABASE "{target_db}" TEMPLATE "{template_name}"'
    )


async def save_as_template(
    admin_conn: asyncpg.Connection, source_db: str, template_name: str
) -> None:
    """Save *source_db* as a Postgres template database.

    1. Terminate other connections to *source_db*
    2. CREATE DATABASE template TEMPLATE source
    3. Mark it as a template so it survives ``DROP DATABASE`` attempts
    """
    # Terminate any lingering connections
    await admin_conn.execute(
        """
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
        """,
        source_db,
    )

    # Drop if a stale template with the same name exists
    existing = await admin_conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1", template_name
    )
    if existing:
        # Unmark as template first so it can be dropped
        await admin_conn.execute(
            f"ALTER DATABASE \"{template_name}\" IS_TEMPLATE false"
        )
        await admin_conn.execute(f'DROP DATABASE "{template_name}"')

    await admin_conn.execute(
        f'CREATE DATABASE "{template_name}" TEMPLATE "{source_db}"'
    )
    await admin_conn.execute(
        f"ALTER DATABASE \"{template_name}\" IS_TEMPLATE true"
    )


async def cleanup_old_templates(
    admin_conn: asyncpg.Connection, keep_count: int = 3
) -> None:
    """Drop old ``template_glow_*`` databases, keeping the *keep_count* newest."""
    rows = await admin_conn.fetch(
        """
        SELECT datname FROM pg_database
        WHERE datname LIKE 'template_glow_%'
        ORDER BY datname DESC
        """
    )
    to_drop = [r["datname"] for r in rows[keep_count:]]
    for name in to_drop:
        try:
            await admin_conn.execute(f'ALTER DATABASE "{name}" IS_TEMPLATE false')
            await admin_conn.execute(f'DROP DATABASE "{name}"')
        except Exception:
            pass  # best-effort cleanup
