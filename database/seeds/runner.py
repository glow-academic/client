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


async def _run_document_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    document_defs: list[dict],
) -> list[UUID]:
    """Run document seed definitions through create_document_client."""
    from app.infra.document_create import CreateDocumentItem, create_document_client

    items = [CreateDocumentItem(**d) for d in document_defs]

    result = await create_document_client(
        pool,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "document_id") and r.document_id:
                created_ids.append(r.document_id)
            print(f"  OK: {r.message}")

    return created_ids


async def _run_department_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    department_defs: list[dict],
) -> list[UUID]:
    """Run department seed definitions through create_department_client."""
    from app.infra.department_create import (
        CreateDepartmentItem,
        create_department_client,
    )

    items = [CreateDepartmentItem(**d) for d in department_defs]

    result = await create_department_client(
        pool,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "department_id") and r.department_id:
                created_ids.append(r.department_id)
            print(f"  OK: {r.message}")

    return created_ids


async def _run_persona_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    persona_defs: list[dict],
) -> list[UUID]:
    """Run persona seed definitions through create_persona_client."""
    from app.infra.persona_create import CreatePersonaItem, create_persona_client

    items = [CreatePersonaItem(**p) for p in persona_defs]

    result = await create_persona_client(
        pool,
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


async def _run_scenario_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    scenario_defs: list[dict],
) -> list[UUID]:
    """Run scenario seed definitions through create_scenario_client."""
    from app.infra.scenario_create import CreateScenarioItem, create_scenario_client

    items = [CreateScenarioItem(**s) for s in scenario_defs]

    result = await create_scenario_client(
        pool,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "scenario_id") and r.scenario_id:
                created_ids.append(r.scenario_id)
            print(f"  OK: {r.message}")

    return created_ids


async def _run_simulation_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    simulation_defs: list[dict],
) -> list[UUID]:
    """Run simulation seed definitions through create_simulation_client."""
    from app.infra.simulation_create import (
        CreateSimulationItem,
        create_simulation_client,
    )

    items = [CreateSimulationItem(**s) for s in simulation_defs]

    result = await create_simulation_client(
        pool,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "simulation_id") and r.simulation_id:
                created_ids.append(r.simulation_id)
            print(f"  OK: {r.message}")

    return created_ids


async def _run_scenario_rubric_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    scenario_rubric_defs: list[dict],
) -> list[UUID]:
    """Run scenario_rubric seed definitions (resource-level create)."""
    from app.routes.v5.tools.resources.scenario_rubrics.create import (
        create_scenario_rubric,
    )

    created_ids: list[UUID] = []
    for sr in scenario_rubric_defs:
        async with pool.acquire() as conn:
            result = await create_scenario_rubric(
                conn,
                scenario_id=sr["scenario_id"],
                rubric_id=sr["rubric_id"],
                redis=redis,
                id=sr.get("id"),
            )
            created_ids.append(result.id)
            print(f"  OK: Scenario rubric created successfully")

    return created_ids


async def _run_rubric_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    rubric_defs: list[dict],
) -> list[UUID]:
    """Run rubric seed definitions through create_rubric_client."""
    from app.infra.rubric_create import CreateRubricItem, create_rubric_client

    items = [CreateRubricItem(**r) for r in rubric_defs]

    result = await create_rubric_client(
        pool,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "rubric_id") and r.rubric_id:
                created_ids.append(r.rubric_id)
            print(f"  OK: {r.message}")

    return created_ids


async def _run_profile_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    profile_defs: list[dict],
) -> list[UUID]:
    """Run profile seed definitions through create_profile_client."""
    from app.infra.profile_create import CreateProfileItem, create_profile_client

    items = [CreateProfileItem(**p) for p in profile_defs]

    result = await create_profile_client(
        pool,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "profile_id") and r.profile_id:
                created_ids.append(r.profile_id)
            print(f"  OK: {r.message}")

    return created_ids


async def _run_setting_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    setting_defs: list[dict],
) -> list[UUID]:
    """Run setting seed definitions through create_setting_client."""
    from app.infra.setting_create import CreateSettingItem, create_setting_client

    items = [CreateSettingItem(**s) for s in setting_defs]

    result = await create_setting_client(
        pool,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "setting_id") and r.setting_id:
                created_ids.append(r.setting_id)
            print(f"  OK: {r.message}")

    return created_ids


async def _run_post_links(
    pool: asyncpg.Pool,
    redis: Redis,
    mod: object,
) -> None:
    """Run post-creation link updates (bidirectional refs).

    Calls the tool-layer update functions directly (not the client-level ones)
    to bypass permission checks — the department may already be "in use" by
    child artifacts, which blocks update_department_client.
    """
    if hasattr(mod, "department_updates"):
        from app.routes.v5.tools.artifacts.department.update import (
            update_department,
        )

        for d in mod.department_updates:
            dept_id = d["id"]
            async with pool.acquire() as conn:
                await update_department(
                    conn,
                    dept_id,
                    settings_ids=d.get("settings_ids"),
                )
            print(f"  OK: Department {dept_id} linked")


async def _run_cohort_seeds(
    pool: asyncpg.Pool,
    redis: Redis,
    cohort_defs: list[dict],
) -> list[UUID]:
    """Run cohort seed definitions through create_cohort_client."""
    from app.infra.cohort_create import CreateCohortItem, create_cohort_client

    items = [CreateCohortItem(**c) for c in cohort_defs]

    result = await create_cohort_client(
        pool,
        redis,
        profile_id=SEED_PROFILE_ID,
        items=items,
    )

    created_ids: list[UUID] = []
    for r in result.results:
        if not r.success:
            print(f"  ERROR: {r.message}")
            if hasattr(r, "errors") and r.errors:
                for e in r.errors:
                    print(f"    - {e.field}: {e.message}")
        else:
            if hasattr(r, "cohort_id") and r.cohort_id:
                created_ids.append(r.cohort_id)
            print(f"  OK: {r.message}")

    return created_ids


# ---------------------------------------------------------------------------
# SQL dump — extract seed-created rows
# ---------------------------------------------------------------------------


async def _get_all_tables(conn: asyncpg.Connection) -> list[str]:
    """Get all user tables in the public schema."""
    rows = await conn.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    )
    return [r["tablename"] for r in rows]


async def _snapshot_counts(
    conn: asyncpg.Connection, tables: list[str]
) -> dict[str, int]:
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
        # Use a single connection for schema/module setup
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

        # 5. Snapshot all tables
        print("Taking pre-seed snapshot...")
        all_tables = await _get_all_tables(conn)
        before = await _snapshot_counts(conn, all_tables)

        await conn.close()

        # 6. Create pool for seed operations (infra functions need asyncpg.Pool)
        pool = await asyncpg.create_pool(pg_url)

        redis_client = Redis.from_url(redis_url)

        # Set env vars needed by app imports
        os.environ.setdefault("SECRET_KEY", "seed_runner_secret_key")
        os.environ.setdefault("AUTH_SECRET", "seed_runner_auth_secret")

        setup_module = importlib.import_module(f"database.seeds.setups.{setup}")

        for module_name in setup_module.MODULES:
            print(f"\nSeeding {module_name}...")
            mod = importlib.import_module(
                f"database.seeds.setups.{setup}.{module_name}"
            )

            if module_name == "departments":
                await _run_department_seeds(pool, redis_client, mod.departments)
            elif module_name == "documents":
                await _run_document_seeds(pool, redis_client, mod.documents)
            elif module_name == "personas":
                await _run_persona_seeds(pool, redis_client, mod.personas)
            elif module_name == "scenarios":
                await _run_scenario_seeds(pool, redis_client, mod.scenarios)
            elif module_name == "rubrics":
                await _run_rubric_seeds(pool, redis_client, mod.rubrics)
            elif module_name == "scenario_rubrics":
                await _run_scenario_rubric_seeds(
                    pool, redis_client, mod.scenario_rubrics
                )
            elif module_name == "simulations":
                await _run_simulation_seeds(pool, redis_client, mod.simulations)
            elif module_name == "cohorts":
                await _run_cohort_seeds(pool, redis_client, mod.cohorts)
            elif module_name == "profiles":
                await _run_profile_seeds(pool, redis_client, mod.profiles)
            elif module_name == "settings":
                await _run_setting_seeds(pool, redis_client, mod.settings)
            elif module_name == "post_links":
                await _run_post_links(pool, redis_client, mod)

        # 7. Dump new rows
        print("\nDumping seed-created rows...")
        async with pool.acquire() as conn:
            new_rows = await _dump_new_rows(conn, before, all_tables)

        total = sum(len(rows) for rows in new_rows.values())
        print(f"  {total} new rows across {len(new_rows)} tables.")

        # 8. Write single SQL dump
        output_dir = MODULES_DIR / "11-setups" / setup
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / "seed.sql"

        lines = [
            f"-- Setup: {setup}",
            f"-- Generated by: database/seeds/runner.py",
            f"-- Modules: {', '.join(setup_module.MODULES)}",
            "-- ============================================================",
            "",
        ]

        for table, rows in sorted(new_rows.items()):
            if rows:
                lines.append(f"-- {table}")
                for row in rows:
                    lines.append(_record_to_insert(table, row))
                lines.append("")

        output_file.write_text("\n".join(lines) + "\n")
        print(f"  Wrote {output_file}")

        await redis_client.aclose()
        await pool.close()

    finally:
        pg.stop()
        redis_container.stop()

    print("\nDone!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run seed definitions")
    parser.add_argument("--setup", default="university", help="Setup name")
    args = parser.parse_args()
    asyncio.run(main(args.setup))
