"""Seed runner — executes Python seed definitions against a temp DB and dumps SQL.

Usage:
    cd server && python -m database.seeds.runner [--setup university]

Flow:
  1. Spin up Postgres + Redis testcontainers
  2. Load schema from database/schema/
  3. Load pre-existing modules (01-resources through 10-systems) as SQL
  4. Run Python seed functions (create_*_client) for the selected setup
  5. Dump only the seed-created rows as SQL INSERT statements
  6. Write to database/modules/11-setups/{setup}/
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import os
import re
import sys
from pathlib import Path
from uuid import UUID

import asyncpg
from redis.asyncio import Redis
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

# Ensure server/ is on sys.path for app imports
SERVER_DIR = Path(__file__).parent.parent.parent / "server"
sys.path.insert(0, str(SERVER_DIR))

DATABASE_DIR = Path(__file__).parent.parent
SCHEMA_DIR = DATABASE_DIR / "schema"
MODULES_DIR = DATABASE_DIR / "modules"
SEEDS_DIR = Path(__file__).parent

# Profile ID for seed operations (Default Superadmin from test fixtures)
SEED_PROFILE_ID = UUID("019b3be4-36f0-788c-9df2-481eb5917940")


# ---------------------------------------------------------------------------
# Schema + module loading (mirrors test conftest.py)
# ---------------------------------------------------------------------------


def _concat_schema(schema_dir: Path) -> str:
    """Concatenate split schema files into a single SQL string."""
    parts: list[str] = []

    ext = schema_dir / "extensions.sql"
    if ext.exists():
        parts.append(ext.read_text())

    funcs = schema_dir / "functions.sql"
    if funcs.exists():
        parts.append(funcs.read_text())

    enums_dir = schema_dir / "enums"
    if enums_dir.exists():
        for f in sorted(enums_dir.glob("*.sql")):
            parts.append(f.read_text())

    subfolders = ("artifacts", "entries", "resources", "junctions", "connections")

    for subfolder in subfolders:
        d = schema_dir / "tables" / subfolder
        if d.exists():
            for f in sorted(d.glob("*.sql")):
                parts.append(f.read_text())

    for subfolder in subfolders:
        d = schema_dir / "indexes" / subfolder
        if d.exists():
            for f in sorted(d.glob("*.sql")):
                parts.append(f.read_text())

    for subfolder in subfolders:
        d = schema_dir / "foreign_keys" / subfolder
        if d.exists():
            for f in sorted(d.glob("*.sql")):
                parts.append(f.read_text())

    parts.append("SET search_path = public;")

    views_dir = schema_dir / "views"
    if views_dir.exists():
        for f in sorted(views_dir.glob("*.sql")):
            parts.append(f.read_text())

    idx_views_dir = schema_dir / "indexes" / "views"
    if idx_views_dir.exists():
        for f in sorted(idx_views_dir.glob("*.sql")):
            parts.append(f.read_text())

    return "\n".join(parts)


def _filter_meta_commands(sql: str) -> str:
    """Remove psql meta-commands (\\connect, SET client_encoding, etc.)."""
    return re.sub(r"^\\.*$", "", sql, flags=re.MULTILINE)


def _load_pre_existing_modules() -> str:
    """Load SQL from modules 01-resources through 10-systems (before setups)."""
    parts: list[str] = []
    for d in sorted(MODULES_DIR.iterdir()):
        if not d.is_dir():
            continue
        # Only load pre-setup modules (01-* through 10-*)
        prefix = d.name.split("-")[0]
        if not prefix.isdigit() or int(prefix) >= 11:
            continue
        # Recursively collect all .sql files in dependency order
        for sql_file in sorted(d.rglob("*.sql")):
            parts.append(sql_file.read_text())
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Seed execution
# ---------------------------------------------------------------------------


async def _run_persona_seeds(
    conn: asyncpg.Connection,
    redis: Redis,
    persona_defs: list[dict],
) -> list[UUID]:
    """Run persona seed definitions through create_persona_client."""
    # Import persona_create directly (infra layer — no route chain)
    from app.infra.persona_create import create_persona_client

    # Load persona types from file to avoid triggering main/__init__.py
    # which imports all routers and cascades into unrelated modules.
    import importlib.util

    types_path = SERVER_DIR / "app" / "routes" / "v5" / "api" / "main" / "persona" / "types.py"
    spec = importlib.util.spec_from_file_location(
        "app.routes.v5.api.main.persona.types", str(types_path)
    )
    persona_types = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = persona_types
    spec.loader.exec_module(persona_types)
    CreatePersonaItem = persona_types.CreatePersonaItem

    items = [CreatePersonaItem(**p) for p in persona_defs]

    result = await create_persona_client(
        conn,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    # Check for errors
    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "persona_id") and r.persona_id:
                created_ids.append(r.persona_id)
            print(f"  OK: {r.message}")

    return created_ids


# ---------------------------------------------------------------------------
# SQL dump — extract seed-created rows
# ---------------------------------------------------------------------------


async def _snapshot_counts(conn: asyncpg.Connection, tables: list[str]) -> dict[str, int]:
    """Record existing row counts for a list of tables."""
    snapshot: dict[str, int] = {}
    for table in tables:
        row = await conn.fetchrow(f'SELECT COUNT(*) AS cnt FROM public."{table}"')
        snapshot[table] = row["cnt"]
    return snapshot


async def _dump_new_rows(
    conn: asyncpg.Connection,
    before: dict[str, int],
    tables: list[str],
) -> dict[str, list[asyncpg.Record]]:
    """Fetch rows that were created after the snapshot (by count offset)."""
    new_rows: dict[str, list[asyncpg.Record]] = {}
    for table in tables:
        old_count = before.get(table, 0)
        rows = await conn.fetch(f'SELECT * FROM public."{table}"')
        # New rows are those beyond the old count — works because we INSERT sequentially
        if len(rows) > old_count:
            new_rows[table] = rows[old_count:]
        elif len(rows) > 0 and old_count == 0:
            new_rows[table] = rows
    return new_rows


def _record_to_insert(table: str, record: asyncpg.Record) -> str:
    """Convert an asyncpg Record to an INSERT ... ON CONFLICT DO NOTHING statement."""
    cols = list(record.keys())
    vals: list[str] = []
    for col in cols:
        v = record[col]
        if v is None:
            vals.append("NULL")
        elif isinstance(v, bool):
            vals.append("true" if v else "false")
        elif isinstance(v, (int, float)):
            vals.append(str(v))
        elif isinstance(v, UUID):
            vals.append(f"'{v}'")
        elif isinstance(v, list):
            # Array literal
            if not v:
                vals.append("'{}'")
            else:
                inner = ",".join(
                    f'"{item}"' if isinstance(item, UUID) else str(item) for item in v
                )
                vals.append(f"'{{{inner}}}'")
        else:
            # String — escape single quotes
            escaped = str(v).replace("'", "''")
            vals.append(f"'{escaped}'")

    col_str = ", ".join(cols)
    val_str = ", ".join(vals)
    return f"INSERT INTO public.{table} ({col_str}) VALUES ({val_str}) ON CONFLICT (id) DO NOTHING;"


# Tables touched by persona creation
PERSONA_TABLES = [
    "names_resource",
    "descriptions_resource",
    "instructions_resource",
    "examples_resource",
    "parameter_fields_resource",
    "personas_resource",
    "persona_artifact",
    "persona_names_junction",
    "persona_descriptions_junction",
    "persona_colors_junction",
    "persona_icons_junction",
    "persona_instructions_junction",
    "persona_examples_junction",
    "persona_flags_junction",
    "persona_parameter_fields_junction",
    "persona_personas_junction",
    "persona_voices_junction",
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main(setup: str = "university") -> None:
    print(f"=== Seed Runner: {setup} ===\n")

    # 1. Start containers
    print("Starting Postgres container...")
    pg = PostgresContainer("postgres:18")
    pg.start()
    pg_url = pg.get_connection_url().replace("postgresql+psycopg2://", "postgresql://")

    print("Starting Redis container...")
    redis_container = RedisContainer("redis:7-alpine")
    redis_container.start()
    redis_host = redis_container.get_container_host_ip()
    redis_port = redis_container.get_exposed_port(6379)
    redis_url = f"redis://{redis_host}:{redis_port}/0"

    try:
        conn = await asyncpg.connect(pg_url)

        # 2. Load schema
        print("Loading schema...")
        await conn.execute("""
            CREATE SCHEMA IF NOT EXISTS keycloak;
            CREATE TABLE IF NOT EXISTS keycloak.org (id text PRIMARY KEY, alias text);
            CREATE TABLE IF NOT EXISTS keycloak.realm (name text PRIMARY KEY, ssl_required text);
        """)
        schema_sql = _filter_meta_commands(_concat_schema(SCHEMA_DIR))
        await conn.execute(schema_sql)
        print("  Schema loaded.")

        # 3. Load pre-existing modules (disable FK checks like load-modules.sh)
        print("Loading pre-existing modules (01-resources through 10-systems)...")
        await conn.execute("SET session_replication_role = replica;")
        modules_sql = _filter_meta_commands(_load_pre_existing_modules())
        await conn.execute(modules_sql)
        await conn.execute("SET session_replication_role = DEFAULT;")
        print("  Modules loaded.")

        # 4. Refresh materialized views
        print("Refreshing materialized views...")
        unpopulated = await conn.fetch(
            "SELECT matviewname FROM pg_matviews WHERE NOT ispopulated"
        )
        for row in unpopulated:
            await conn.execute(f'REFRESH MATERIALIZED VIEW "{row["matviewname"]}"')
        print(f"  {len(unpopulated)} MVs refreshed.")

        # 5. Snapshot existing IDs
        print("Taking pre-seed snapshot...")
        before = await _snapshot_counts(conn, PERSONA_TABLES)

        # 6. Run seeds
        redis_client = Redis.from_url(redis_url)

        # Set env vars needed by app imports
        os.environ.setdefault("SECRET_KEY", "seed_runner_secret_key")
        os.environ.setdefault("AUTH_SECRET", "seed_runner_auth_secret")

        setup_module = importlib.import_module(
            f"database.seeds.setups.{setup}"
        )

        for module_name in setup_module.MODULES:
            print(f"\nSeeding {module_name}...")
            mod = importlib.import_module(
                f"database.seeds.setups.{setup}.{module_name}"
            )

            if module_name == "personas":
                await _run_persona_seeds(conn, redis_client, mod.personas)

        # 7. Dump new rows
        print("\nDumping seed-created rows...")
        new_rows = await _dump_new_rows(conn, before, PERSONA_TABLES)

        total = sum(len(rows) for rows in new_rows.values())
        print(f"  {total} new rows across {len(new_rows)} tables.")

        # 8. Write SQL output
        output_dir = MODULES_DIR / "11-setups" / setup / "02-personas"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Group by persona name (from personas_resource)
        persona_resources = new_rows.get("personas_resource", [])
        if persona_resources:
            for pr in persona_resources:
                slug = pr["name"].lower().replace(" ", "-").replace("(", "").replace(")", "")
                filename = f"{slug}.sql"
                filepath = output_dir / filename

                lines = [
                    f"-- Module: {pr['name']}",
                    f"-- Category: persona",
                    f"-- Description: {pr['name']} persona",
                    f"-- Generated by: database/seeds/runner.py",
                    "-- ============================================================",
                    "",
                ]

                # Collect all rows related to this persona
                # (We write all new rows into a single combined file for now)
                for table, rows in sorted(new_rows.items()):
                    for row in rows:
                        lines.append(_record_to_insert(table, row))

                filepath.write_text("\n".join(lines) + "\n")
                print(f"  Wrote {filepath}")

        await redis_client.aclose()
        await conn.close()

    finally:
        pg.stop()
        redis_container.stop()

    print("\nDone!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run seed definitions")
    parser.add_argument("--setup", default="university", help="Setup name")
    args = parser.parse_args()
    asyncio.run(main(args.setup))
