#!/usr/bin/env python3
"""
Export modular seed data from the live database.

Generates object-based SQL module files — each file contains all INSERTs needed
for a single logical object (artifact + junctions + resource rows), with
ON CONFLICT DO NOTHING for idempotency.

Usage:
    python export_modules.py            # Export all modules
    python export_modules.py relations  # Export only 00-relations/
    python export_modules.py resources  # Export only 01-resources/
    python export_modules.py providers  # Export only 02-providers/
    python export_modules.py models     # Export only 03-models/
    python export_modules.py agents     # Export only 04-agents/
    python export_modules.py tools      # Export only 05-tools/
    python export_modules.py auth       # Export only 06-auth/
    python export_modules.py setup      # Export only 11-setups/
"""

import asyncio
import os
import re
import shutil
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

import asyncpg

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
DB_DIR = SCRIPT_DIR.parent
MODULES_DIR = DB_DIR / "modules"
PROJECT_ROOT = DB_DIR.parent

# Load .env if present
env_file = DB_DIR / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

DB_USER = os.environ.get("DB_USER", "myuser")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "mypassword")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "mydb")

# ---------------------------------------------------------------------------
# Tables exported fully in 01-resources/ (never exported per-artifact)
# ---------------------------------------------------------------------------
RESOURCE_TABLES = {
    "colors_resource",
    "icons_resource",
    "flags_resource",
    "roles_resource",
    "routes_resource",
    "role_routes_resource",
    "modalities_resource",
    "qualities_resource",
    "thresholds_resource",
    "points_resource",
    "protocols_resource",
    "domains_resource",
    "slugs_resource",
    "texts_resource",
    "args_resource",
    "args_outputs_resource",
    "request_limits_resource",
    "voices_resource",
    "values_resource",
    "reasoning_levels_resource",
    "temperature_levels_resource",
    # Secrets/key tables (exported with dummy values via SENSITIVE_COLUMNS)
    "keys_resource",
    "provider_keys_resource",
    "auth_item_keys_resource",
}

# Tables that should NEVER be exported (runtime / entry tables)
EXCLUDED_TABLES = {
    "runs_resource",
    "groups_resource",
    # Entry tables referenced by some junctions
    "activity_entry",
    "audits_entry",
    "calls_entry",
}

# Junction tables to skip entirely (point to runtime/entry tables)
EXCLUDED_JUNCTIONS = {
    "tool_calls_junction",
    "profile_activity_junction",
    "scenario_parameter_fields_junction",
    "simulation_scenarios_junction",  # Dead — all orphans; scenarios linked via simulations_resource.scenario_ids
    "scenario_tree_junction",  # Uses parent_id/child_id, not scenario_id; handled specially
}

# Sensitive columns: table -> column -> dummy value
# These columns contain secrets and are replaced with dummy values during export
SENSITIVE_COLUMNS: dict[str, dict[str, str]] = {
    "keys_resource": {"key": "dummy-key-value"},
    "provider_keys_resource": {"key": "dummy-provider-key-value"},
}

# Non-standard artifact FK column names in junction tables
# Normally: {artifact_type}_id (e.g., "setting_id" for setting junctions)
# These tables deviate from the pattern:
JUNCTION_FK_OVERRIDES: dict[str, str] = {
    "setting_auth_values_junction": "settings_id",
    "setting_auths_junction": "settings_id",
}

# ---------------------------------------------------------------------------
# Metadata cache (loaded once at startup)
# ---------------------------------------------------------------------------
# table_name -> [col_name, ...]
TABLE_COLUMNS: dict[str, list[str]] = {}
# table_name -> [col_name, ...] (PK columns only)
TABLE_PKS: dict[str, list[str]] = {}
# (junction_table, fk_col) -> target_table
FK_MAP: dict[tuple[str, str], str] = {}


async def load_metadata(conn: asyncpg.Connection) -> None:
    """Load all table columns, PKs, and FK mappings from pg_catalog."""

    # 1. All columns for public tables (ordered by ordinal_position)
    rows = await conn.fetch("""
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """)
    for r in rows:
        TABLE_COLUMNS.setdefault(r["table_name"], []).append(r["column_name"])

    # 2. Primary keys
    rows = await conn.fetch("""
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY tc.table_name, kcu.ordinal_position
    """)
    for r in rows:
        TABLE_PKS.setdefault(r["table_name"], []).append(r["column_name"])

    # 3. All FK constraints (junction column -> target table)
    rows = await conn.fetch("""
        SELECT
            cl_src.relname AS source_table,
            att_src.attname AS source_column,
            cl_tgt.relname AS target_table
        FROM pg_constraint con
        JOIN pg_class cl_src ON con.conrelid = cl_src.oid
        JOIN pg_namespace ns ON cl_src.relnamespace = ns.oid
        JOIN pg_class cl_tgt ON con.confrelid = cl_tgt.oid
        CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS src(attnum, ord)
        JOIN pg_attribute att_src ON att_src.attrelid = cl_src.oid AND att_src.attnum = src.attnum
        WHERE con.contype = 'f' AND ns.nspname = 'public'
    """)
    for r in rows:
        FK_MAP[(r["source_table"], r["source_column"])] = r["target_table"]


# ---------------------------------------------------------------------------
# SQL literal formatting
# ---------------------------------------------------------------------------


def sql_literal(val: Any) -> str:
    """Convert a Python value to a SQL literal string."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (int, float, Decimal)):
        return str(val)
    if isinstance(val, str):
        escaped = val.replace("'", "''")
        return f"'{escaped}'"
    if isinstance(val, UUID):
        return f"'{val}'"
    if isinstance(val, datetime):
        return f"'{val.isoformat()}'"
    if isinstance(val, date):
        return f"'{val.isoformat()}'"
    if isinstance(val, time):
        return f"'{val.isoformat()}'"
    if isinstance(val, timedelta):
        return f"'{val}'"
    if isinstance(val, list):
        # PostgreSQL array literal: '{elem1,elem2,...}'
        if not val:
            return "'{}'"
        inner = ",".join(_array_element(v) for v in val)
        # Escape single quotes for the outer SQL string literal
        inner = inner.replace("'", "''")
        return f"'{{{inner}}}'"
    if isinstance(val, bytes):
        return f"'\\x{val.hex()}'"
    # Fallback: treat as text
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def _array_element(val: Any) -> str:
    """Format a single element inside a PostgreSQL array literal."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "t" if val else "f"
    if isinstance(val, (int, float, Decimal)):
        return str(val)
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, str):
        # Inside array literals, double-quote strings that contain special chars
        if any(c in val for c in (",", '"', "{", "}", " ", "\\")):
            escaped = val.replace("\\", "\\\\").replace('"', '\\"')
            return f'"{escaped}"'
        return val
    return str(val)


# ---------------------------------------------------------------------------
# INSERT generation
# ---------------------------------------------------------------------------


def make_insert(
    table: str, record: asyncpg.Record, columns: list[str], pk_cols: list[str]
) -> str:
    """Generate an INSERT ... ON CONFLICT DO NOTHING statement."""
    sensitive = SENSITIVE_COLUMNS.get(table, {})
    vals = ", ".join(
        sql_literal(sensitive[c]) if c in sensitive else sql_literal(record[c])
        for c in columns
    )
    cols = ", ".join(columns)
    stmt = f"INSERT INTO public.{table} ({cols}) VALUES ({vals})"
    if pk_cols:
        pk = ", ".join(pk_cols)
        stmt += f" ON CONFLICT ({pk}) DO NOTHING"
    return stmt + ";"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def to_slug(name: str) -> str:
    """Convert a name to a URL-safe slug."""
    s = name.lower()
    s = re.sub(r"[^a-z0-9\s._-]", "", s)
    s = re.sub(r"[\s]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def get_junction_resource_fk(
    junction_table: str, artifact_type: str
) -> tuple[str, str] | None:
    """
    Given a junction table and artifact type, find the FK column + resource table
    for the 'other side' of the junction (not the artifact_id column).
    Uses actual FK constraint metadata — no guessing.
    """
    artifact_col = f"{artifact_type}_id"
    for (src_table, src_col), tgt_table in FK_MAP.items():
        if src_table != junction_table:
            continue
        if src_col == artifact_col:
            continue
        # Skip if target is an artifact table (cross-artifact refs)
        if tgt_table.endswith("_artifact"):
            continue
        # Skip excluded tables
        if tgt_table in EXCLUDED_TABLES:
            continue
        # Skip base resource tables (they're exported in 00-base/)
        if tgt_table in RESOURCE_TABLES:
            continue
        return (src_col, tgt_table)
    return None


def get_all_junction_fks(
    junction_table: str, artifact_type: str
) -> list[tuple[str, str]]:
    """
    Get ALL FK columns + resource tables for a junction (not the artifact_id col).
    Some junctions (like tool_args_outputs_junction) have multiple resource FKs.
    """
    artifact_col = get_artifact_fk_col(junction_table, artifact_type)
    results = []
    for (src_table, src_col), tgt_table in FK_MAP.items():
        if src_table != junction_table:
            continue
        if src_col == artifact_col:
            continue
        if tgt_table.endswith("_artifact"):
            continue
        if tgt_table in EXCLUDED_TABLES:
            continue
        if tgt_table in RESOURCE_TABLES:
            continue
        results.append((src_col, tgt_table))
    return results


def get_artifact_fk_col(junction_table: str, artifact_type: str) -> str:
    """Get the FK column name that points to the artifact in a junction table."""
    if junction_table in JUNCTION_FK_OVERRIDES:
        return JUNCTION_FK_OVERRIDES[junction_table]
    return f"{artifact_type}_id"


async def get_junction_tables(
    conn: asyncpg.Connection, artifact_type: str
) -> list[str]:
    """Get all junction table names for an artifact type."""
    rows = await conn.fetch(
        """
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE $1
        ORDER BY tablename
    """,
        f"{artifact_type}_%_junction",
    )
    result = []
    for r in rows:
        tn = r["tablename"]
        if tn in EXCLUDED_JUNCTIONS:
            continue
        # Verify the artifact FK column exists in this table
        art_col = get_artifact_fk_col(tn, artifact_type)
        if art_col not in TABLE_COLUMNS.get(tn, []):
            continue
        result.append(tn)
    return result


async def get_artifacts_with_names(
    conn: asyncpg.Connection, artifact_type: str
) -> list[tuple[str, str]]:
    """Get (artifact_id, name) pairs for all artifacts of a type."""
    artifact_table = f"{artifact_type}_artifact"
    names_junction = f"{artifact_type}_names_junction"
    rows = await conn.fetch(f"""
        SELECT a.id, nr.name
        FROM {artifact_table} a
        JOIN {names_junction} nj ON a.id = nj.{artifact_type}_id
        JOIN names_resource nr ON nj.name_id = nr.id
        ORDER BY nr.name
    """)
    return [(str(r["id"]), r["name"]) for r in rows]


# ---------------------------------------------------------------------------
# Core export functions
# ---------------------------------------------------------------------------


async def export_table_full(
    conn: asyncpg.Connection, table: str, f, label: str | None = None
) -> int:
    """Export all rows from a table. Returns number of rows exported."""
    cols = TABLE_COLUMNS.get(table)
    if not cols:
        return 0
    pk_cols = TABLE_PKS.get(table, [])

    col_list = ", ".join(cols)
    # Try to order by created_at if present, else by first column
    order_col = "created_at" if "created_at" in cols else cols[0]
    rows = await conn.fetch(
        f"SELECT {col_list} FROM public.{table} ORDER BY {order_col}"
    )

    if not rows:
        f.write(f"\n-- {label or ('Table: ' + table)}\n-- (no rows)\n")
        return 0

    f.write(f"\n-- {label or ('Table: ' + table)}\n")
    for row in rows:
        f.write(make_insert(table, row, cols, pk_cols) + "\n")
    return len(rows)


async def export_resource_rows_for_artifact(
    conn: asyncpg.Connection,
    artifact_type: str,
    artifact_id: str,
    junction_tables: list[str],
    f,
    seen_resource_ids: set[tuple[str, str]] | None = None,
) -> None:
    """Export resource rows reachable from junction tables for one artifact."""
    if seen_resource_ids is None:
        seen_resource_ids = set()

    for jt in junction_tables:
        artifact_col = get_artifact_fk_col(jt, artifact_type)
        fk_pairs = get_all_junction_fks(jt, artifact_type)
        for fk_col, resource_table in fk_pairs:
            res_cols = TABLE_COLUMNS.get(resource_table)
            res_pk = TABLE_PKS.get(resource_table, [])
            if not res_cols:
                continue

            # Get resource IDs from junction
            jt_rows = await conn.fetch(
                f"SELECT {fk_col} FROM public.{jt} WHERE {artifact_col} = $1",
                UUID(artifact_id),
            )
            for jt_row in jt_rows:
                rid = jt_row[fk_col]
                if rid is None:
                    continue
                key = (resource_table, str(rid))
                if key in seen_resource_ids:
                    continue
                seen_resource_ids.add(key)

                # Fetch the resource row
                pk_col = res_pk[0] if res_pk else "id"
                col_list = ", ".join(res_cols)
                res_row = await conn.fetchrow(
                    f"SELECT {col_list} FROM public.{resource_table} WHERE {pk_col} = $1",
                    rid,
                )
                if res_row:
                    f.write(
                        make_insert(resource_table, res_row, res_cols, res_pk) + "\n"
                    )


async def export_artifact_row(
    conn: asyncpg.Connection,
    artifact_type: str,
    artifact_id: str,
    f,
) -> None:
    """Export a single artifact row."""
    table = f"{artifact_type}_artifact"
    cols = TABLE_COLUMNS.get(table)
    pk_cols = TABLE_PKS.get(table, [])
    if not cols:
        return
    col_list = ", ".join(cols)
    row = await conn.fetchrow(
        f"SELECT {col_list} FROM public.{table} WHERE id = $1",
        UUID(artifact_id),
    )
    if row:
        f.write(f"-- {table}\n")
        f.write(make_insert(table, row, cols, pk_cols) + "\n")
    else:
        print(f"    WARNING: No row in {table} for id={artifact_id}")


async def export_junction_rows_for_artifact(
    conn: asyncpg.Connection,
    artifact_type: str,
    artifact_id: str,
    junction_tables: list[str],
    f,
) -> None:
    """Export junction rows for one artifact."""
    for jt in junction_tables:
        artifact_col = get_artifact_fk_col(jt, artifact_type)
        cols = TABLE_COLUMNS.get(jt)
        pk_cols = TABLE_PKS.get(jt, [])
        if not cols:
            continue

        col_list = ", ".join(cols)
        rows = await conn.fetch(
            f"SELECT {col_list} FROM public.{jt} WHERE {artifact_col} = $1",
            UUID(artifact_id),
        )
        if rows:
            f.write(f"-- {jt}\n")
            for row in rows:
                f.write(make_insert(jt, row, cols, pk_cols) + "\n")


# ---------------------------------------------------------------------------
# Module export: write a complete module file for one artifact
# ---------------------------------------------------------------------------


async def write_artifact_module(
    conn: asyncpg.Connection,
    artifact_type: str,
    artifact_id: str,
    junction_tables: list[str],
    output_path: Path,
    header: str,
    *,
    append: bool = False,
    seen_resource_ids: set[tuple[str, str]] | None = None,
) -> int:
    """Write a complete module file. Returns INSERT count."""
    mode = "a" if append else "w"
    with open(output_path, mode) as f:
        if not append:
            f.write(header)
            f.write("\n-- Resource rows\n")
        else:
            f.write(f"\n-- Additional artifact: {artifact_id}\n")
            f.write("-- Resource rows\n")

        await export_resource_rows_for_artifact(
            conn, artifact_type, artifact_id, junction_tables, f, seen_resource_ids
        )

        f.write("\n-- Artifact\n")
        await export_artifact_row(conn, artifact_type, artifact_id, f)

        f.write("\n-- Junctions\n")
        await export_junction_rows_for_artifact(
            conn, artifact_type, artifact_id, junction_tables, f
        )

    # Count inserts
    count = sum(
        1
        for line in output_path.read_text().splitlines()
        if line.startswith("INSERT INTO")
    )
    return count


# ---------------------------------------------------------------------------
# 00-base: System resource tables
# ---------------------------------------------------------------------------


async def export_relations(conn: asyncpg.Connection) -> None:
    """Export relation tables to 00-relations/, one file per table."""
    print("Exporting 00-relations/ ...")
    rel_dir = MODULES_DIR / "00-relations"
    if rel_dir.exists():
        for old in rel_dir.glob("*.sql"):
            old.unlink()
    rel_dir.mkdir(parents=True, exist_ok=True)

    relation_files: list[tuple[str, str, list[str]]] = [
        ("00-artifact-flags", "artifact-flags", ["artifact_flags_relation"]),
        ("01-artifact-outputs", "artifact-outputs", ["artifact_outputs_relation"]),
        ("02-artifact-resources", "artifact-resources", ["artifact_resources_relation"]),
        ("03-artifact-roles", "artifact-roles", ["artifact_roles_relation"]),
        ("04-artifact-routes", "artifact-routes", ["artifact_routes_relation"]),
        ("05-artifact-units", "artifact-units", ["artifact_units_relation"]),
        ("06-artifact-views", "artifact-views", ["artifact_view_relation"]),
        ("07-entry-resources", "entry-resources", ["entry_resource_relation"]),
        ("08-entry-tools", "entry-tools", ["entry_tools_relation"]),
        ("09-resource-entries", "resource-entries", ["resource_entry_relation"]),
        ("10-resource-flags", "resource-flags", ["resource_flags_relation"]),
        ("11-resource-modalities", "resource-modalities", ["resource_modalities_relation"]),
        ("12-resource-outputs", "resource-outputs", ["resource_outputs_relation"]),
        ("13-resource-resources", "resource-resources", ["resource_resource_relation"]),
        ("14-resource-tools", "resource-tools", ["resource_tools_relation"]),
        ("15-view-entries", "view-entries", ["view_entry_relation"]),
        ("16-view-outputs", "view-outputs", ["view_outputs_relation"]),
        ("17-view-resources", "view-resources", ["view_resource_relation"]),
    ]

    for file_prefix, label, tables in relation_files:
        output_path = rel_dir / f"{file_prefix}.sql"
        with open(output_path, "w") as f:
            f.write(f"-- Module: {label}\n")
            f.write("-- Category: relations\n")
            f.write(f"-- Description: {label} relation data\n")
            f.write("-- ============================================================\n")

            total = 0
            for table in tables:
                n = await export_table_full(conn, table, f, f"Table: {table}")
                total += n

        print(f"    {file_prefix}.sql ({total} inserts)")


async def export_resources(conn: asyncpg.Connection) -> None:
    """Export standalone resource tables to 01-resources/."""
    print("Exporting 01-resources/ ...")
    res_dir = MODULES_DIR / "01-resources"
    if res_dir.exists():
        for old in res_dir.glob("*.sql"):
            old.unlink()
    res_dir.mkdir(parents=True, exist_ok=True)

    resource_files: list[tuple[str, str, list[str]]] = [
        ("00-colors", "colors", ["colors_resource"]),
        ("01-icons", "icons", ["icons_resource"]),
        ("02-flags", "flags", ["flags_resource"]),
        (
            "03-roles-routes",
            "roles-routes",
            ["roles_resource", "routes_resource", "role_routes_resource"],
        ),
        ("04-modalities", "modalities", ["modalities_resource"]),
        ("05-qualities", "qualities", ["qualities_resource"]),
        ("06-thresholds", "thresholds", ["thresholds_resource"]),
        ("07-points", "points", ["points_resource"]),
        ("08-protocols", "protocols", ["protocols_resource"]),
        ("09-domains", "domains", ["domains_resource"]),
        ("10-slugs", "slugs", ["slugs_resource"]),
        ("11-texts", "texts", ["texts_resource"]),
        ("12-args", "args", ["args_resource", "args_outputs_resource"]),
        ("13-request-limits", "request-limits", ["request_limits_resource"]),
        ("14-voices", "voices", ["voices_resource"]),
        ("15-values", "values", ["values_resource"]),
        ("16-reasoning-levels", "reasoning-levels", ["reasoning_levels_resource"]),
        (
            "17-temperature-levels",
            "temperature-levels",
            ["temperature_levels_resource"],
        ),
        # Secrets/key tables (sensitive columns replaced with dummy values)
        ("18-keys", "keys", ["keys_resource", "provider_keys_resource"]),
        ("19-auth-item-keys", "auth-item-keys", ["auth_item_keys_resource"]),
    ]

    for file_prefix, label, tables in resource_files:
        output_path = res_dir / f"{file_prefix}.sql"
        with open(output_path, "w") as f:
            f.write(f"-- Module: {label}\n")
            f.write("-- Category: resources\n")
            f.write(f"-- Description: {label} resource data\n")
            f.write("-- ============================================================\n")

            total = 0
            for table in tables:
                n = await export_table_full(conn, table, f, f"Table: {table}")
                total += n

        print(f"    {file_prefix}.sql ({total} inserts)")


# ---------------------------------------------------------------------------
# 02-providers: One file per AI provider
# ---------------------------------------------------------------------------


async def export_providers(conn: asyncpg.Connection) -> None:
    print("Exporting 02-providers/ ...")
    providers_dir = MODULES_DIR / "02-providers"
    providers_dir.mkdir(parents=True, exist_ok=True)

    artifacts = await get_artifacts_with_names(conn, "provider")
    junctions = await get_junction_tables(conn, "provider")

    for art_id, art_name in artifacts:
        slug = to_slug(art_name)
        output_path = providers_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: provider\n"
            f"-- Description: {art_name} AI provider\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "provider", art_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


# ---------------------------------------------------------------------------
# 03-models: One file per model, grouped by provider
# ---------------------------------------------------------------------------


async def export_models(conn: asyncpg.Connection) -> None:
    print("Exporting 03-models/ ...")

    # Get models with provider info
    rows = await conn.fetch("""
        SELECT ma.id, nr.name, pr.name AS provider
        FROM model_artifact ma
        JOIN model_names_junction mnj ON ma.id = mnj.model_id
        JOIN names_resource nr ON mnj.name_id = nr.id
        JOIN model_providers_junction mpj ON ma.id = mpj.model_id
        JOIN providers_resource pr ON mpj.providers_id = pr.id
        ORDER BY pr.name, nr.name
    """)

    junctions = await get_junction_tables(conn, "model")

    # Track processed model names for multi-artifact models (e.g., gpt-image-1)
    processed: dict[str, set[tuple[str, str]]] = {}  # key -> seen_resource_ids

    for r in rows:
        model_id = str(r["id"])
        model_name = r["name"]
        provider_name = r["provider"]

        provider_slug = to_slug(provider_name)
        model_slug = to_slug(model_name)
        file_key = f"{provider_slug}/{model_slug}"

        model_dir = MODULES_DIR / "03-models" / provider_slug
        model_dir.mkdir(parents=True, exist_ok=True)
        output_path = model_dir / f"{model_slug}.sql"

        if file_key not in processed:
            # First artifact for this model name
            header = (
                f"-- Module: {model_name}\n"
                f"-- Provider: {provider_name}\n"
                f"-- Description: {provider_name} {model_name} model\n"
                f"-- ============================================================\n\n"
            )
            seen = set()
            processed[file_key] = seen
            count = await write_artifact_module(
                conn,
                "model",
                model_id,
                junctions,
                output_path,
                header,
                seen_resource_ids=seen,
            )
        else:
            # Additional artifact (quality variant etc.)
            seen = processed[file_key]
            count = await write_artifact_module(
                conn,
                "model",
                model_id,
                junctions,
                output_path,
                "",
                append=True,
                seen_resource_ids=seen,
            )

    file_count = sum(1 for _ in (MODULES_DIR / "03-models").rglob("*.sql"))
    print(f"    Generated {file_count} model module files")


# ---------------------------------------------------------------------------
# 04-agents: One file per system agent
# ---------------------------------------------------------------------------


async def export_agents(conn: asyncpg.Connection) -> None:
    print("Exporting 04-agents/ ...")
    agents_dir = MODULES_DIR / "04-agents"
    agents_dir.mkdir(parents=True, exist_ok=True)

    rows = await conn.fetch("""
        SELECT a.id, nr.name
        FROM agent_artifact a
        JOIN agent_names_junction nj ON a.id = nj.agent_id
        JOIN names_resource nr ON nj.name_id = nr.id
        WHERE EXISTS (
            SELECT 1 FROM agent_flags_junction af
            JOIN flags_resource f ON f.id = af.flag_id
            WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true
        )
        ORDER BY nr.name
    """)
    artifacts = [(str(r["id"]), r["name"]) for r in rows]
    junctions = await get_junction_tables(conn, "agent")

    for art_id, art_name in artifacts:
        slug = to_slug(art_name)
        output_path = agents_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: agent\n"
            f"-- Description: {art_name} system agent\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "agent", art_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


# ---------------------------------------------------------------------------
# 05-tools: One file per tool
# ---------------------------------------------------------------------------


async def export_tools(conn: asyncpg.Connection) -> None:
    print("Exporting 05-tools/ ...")
    tools_dir = MODULES_DIR / "05-tools"
    tools_dir.mkdir(parents=True, exist_ok=True)

    artifacts = await get_artifacts_with_names(conn, "tool")
    junctions = await get_junction_tables(conn, "tool")

    for art_id, art_name in artifacts:
        slug = to_slug(art_name)
        output_path = tools_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: tool\n"
            f"-- Description: {art_name} MCP tool\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "tool", art_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


# ---------------------------------------------------------------------------
# 06-auth: Auth providers (generic → 06-auth/, institution → 11-setups/)
# ---------------------------------------------------------------------------


async def export_auth(conn: asyncpg.Connection) -> None:
    print("Exporting 06-auth/ ...")
    auth_dir = MODULES_DIR / "06-auth"
    auth_dir.mkdir(parents=True, exist_ok=True)

    # Only export auth providers with auth_active flag = true
    active_artifacts = await conn.fetch("""
        SELECT a.id, nr.name
        FROM auth_artifact a
        JOIN auth_names_junction nj ON a.id = nj.auth_id
        JOIN names_resource nr ON nj.name_id = nr.id
        WHERE EXISTS (
            SELECT 1 FROM auth_flags_junction af
            JOIN flags_resource f ON f.id = af.flag_id
            WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = true
        )
        ORDER BY nr.name
    """)
    artifacts = [(str(r["id"]), r["name"]) for r in active_artifacts]
    junctions = await get_junction_tables(conn, "auth")

    for art_id, art_name in artifacts:
        slug = to_slug(art_name)

        # Route institution-specific auth to 11-setups/
        if "purdue" in art_name.lower() or "university" in art_name.lower():
            out_dir = MODULES_DIR / "11-setups" / "university" / "00-auth"
        else:
            out_dir = auth_dir
        out_dir.mkdir(parents=True, exist_ok=True)

        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: auth\n"
            f"-- Description: {art_name} authentication provider\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "auth", art_id, junctions, output_path, header
        )
        print(f"    {output_path.relative_to(MODULES_DIR)} ({count} inserts)")


# ---------------------------------------------------------------------------
# 11-setups/university: Setup-specific objects
# ---------------------------------------------------------------------------


async def export_setup_per_artifact(
    conn: asyncpg.Connection,
    artifact_type: str,
    subfolder: str,
    category: str,
    *,
    active_flag: str | None = None,
    filter_name: str | None = None,
) -> None:
    """Export one file per artifact (departments, personas, rubrics).

    If active_flag is set, only export artifacts where that flag is true.
    If filter_name is set, only export the artifact with that exact name.
    """
    print(f"  Exporting {subfolder}/ ...")
    out_dir = MODULES_DIR / "11-setups" / "university" / subfolder
    if out_dir.exists():
        for old in out_dir.glob("*.sql"):
            old.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)

    if active_flag:
        rows = await conn.fetch(
            f"""
            SELECT a.id, nr.name
            FROM {artifact_type}_artifact a
            JOIN {artifact_type}_names_junction nj ON a.id = nj.{artifact_type}_id
            JOIN names_resource nr ON nj.name_id = nr.id
            WHERE EXISTS (
                SELECT 1 FROM {artifact_type}_flags_junction af
                JOIN flags_resource f ON f.id = af.flag_id
                WHERE af.{artifact_type}_id = a.id AND f.name = $1 AND af.value = true
            )
            ORDER BY nr.name
        """,
            active_flag,
        )
        artifacts = [(str(r["id"]), r["name"]) for r in rows]
    elif filter_name:
        rows = await conn.fetch(
            f"""
            SELECT a.id, nr.name
            FROM {artifact_type}_artifact a
            JOIN {artifact_type}_names_junction nj ON a.id = nj.{artifact_type}_id
            JOIN names_resource nr ON nj.name_id = nr.id
            WHERE nr.name = $1
            ORDER BY nr.name
        """,
            filter_name,
        )
        artifacts = [(str(r["id"]), r["name"]) for r in rows]
    else:
        artifacts = await get_artifacts_with_names(conn, artifact_type)
    junctions = await get_junction_tables(conn, artifact_type)

    for art_id, art_name in artifacts:
        slug = to_slug(art_name).replace(",", "")
        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: {category}\n"
            f"-- Description: {art_name} {category}\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, artifact_type, art_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


async def export_setup_all_in_one(
    conn: asyncpg.Connection,
    artifact_type: str,
    subfolder: str,
    filename: str = "all",
) -> None:
    """Export all artifacts of a type into a single 'all.sql' file."""
    print(f"  Exporting {subfolder}/ ...")
    out_dir = MODULES_DIR / "11-setups" / "university" / subfolder
    if out_dir.exists():
        for old in out_dir.glob("*.sql"):
            old.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)
    output_path = out_dir / f"{filename}.sql"

    artifact_table = f"{artifact_type}_artifact"
    rows = await conn.fetch(
        f"SELECT id FROM public.{artifact_table} ORDER BY created_at"
    )
    junctions = await get_junction_tables(conn, artifact_type)

    seen = set()
    with open(output_path, "w") as f:
        f.write(f"-- Module: all {artifact_type}s\n")
        f.write("-- Category: setup/university\n")
        f.write(f"-- Description: All {artifact_type} artifacts for university setup\n")
        f.write("-- ============================================================\n")

        if not rows:
            f.write("\n-- (no rows)\n")
            print(f"    {filename}.sql (0 inserts)")
            return

        # Pass 1: resource rows
        f.write("\n-- Resource rows\n")
        for r in rows:
            art_id = str(r["id"])
            await export_resource_rows_for_artifact(
                conn, artifact_type, art_id, junctions, f, seen
            )

        # Pass 2: artifact rows
        f.write("\n-- Artifacts\n")
        for r in rows:
            await export_artifact_row(conn, artifact_type, str(r["id"]), f)

        # Pass 3: junction rows
        f.write("\n-- Junctions\n")
        for r in rows:
            await export_junction_rows_for_artifact(
                conn, artifact_type, str(r["id"]), junctions, f
            )

    count = sum(
        1
        for line in output_path.read_text().splitlines()
        if line.startswith("INSERT INTO")
    )
    print(f"    {filename}.sql ({count} inserts)")


async def export_rubrics(conn: asyncpg.Connection) -> None:
    """Export rubrics split by simulation/video flags.

    - simulation_rubric=true OR video_rubric=true → 11-setups/university/05-rubrics/
    - otherwise → 07-rubrics/ (module root)
    """
    print("  Exporting 07-rubrics/ (split base/university) ...")

    base_dir = MODULES_DIR / "07-rubrics"
    univ_dir = MODULES_DIR / "11-setups" / "university" / "05-rubrics"
    # Clean stale files before writing
    for d in (base_dir, univ_dir):
        if d.exists():
            for old in d.glob("*.sql"):
                old.unlink()
    base_dir.mkdir(parents=True, exist_ok=True)
    univ_dir.mkdir(parents=True, exist_ok=True)

    # Query rubric artifacts with their flags
    rows = await conn.fetch("""
        SELECT ra.id, nr.name,
               COALESCE(rr.simulation_rubric, false) as simulation_rubric,
               COALESCE(rr.video_rubric, false) as video_rubric
        FROM rubric_artifact ra
        JOIN rubric_names_junction rnj ON rnj.rubric_id = ra.id
        JOIN names_resource nr ON nr.id = rnj.name_id
        JOIN rubric_rubrics_junction rrj ON rrj.rubric_id = ra.id
        JOIN rubrics_resource rr ON rr.id = rrj.rubrics_id
        ORDER BY nr.name
    """)

    junctions = await get_junction_tables(conn, "rubric")

    for r in rows:
        art_id = str(r["id"])
        art_name = r["name"]
        slug = to_slug(art_name).replace(",", "")

        is_university = r["simulation_rubric"] or r["video_rubric"]
        out_dir = univ_dir if is_university else base_dir
        section = "university" if is_university else "base"

        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: rubric ({section})\n"
            f"-- Description: {art_name} rubric\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "rubric", art_id, junctions, output_path, header
        )
        print(f"    {output_path.relative_to(MODULES_DIR)} ({count} inserts)")


async def export_evals(conn: asyncpg.Connection) -> None:
    """Export one file per eval into 08-evals/ at module root."""
    print("  Exporting 08-evals/ ...")
    out_dir = MODULES_DIR / "08-evals"
    out_dir.mkdir(parents=True, exist_ok=True)

    artifacts = await get_artifacts_with_names(conn, "eval")
    junctions = await get_junction_tables(conn, "eval")

    for art_id, art_name in artifacts:
        slug = to_slug(art_name)
        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: eval\n"
            f"-- Description: {art_name} eval\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "eval", art_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


async def export_base_profiles(conn: asyncpg.Connection) -> None:
    """Export default profiles to 09-profiles/ (base data only).

    Exports the profile artifact + all junctions EXCEPT
    profile_departments_junction and profile_emails_junction, which are
    section-specific and exported per setup (organization/university).
    """
    print("Exporting 09-profiles/ ...")
    out_dir = MODULES_DIR / "09-profiles"
    if out_dir.exists():
        for old in out_dir.glob("*.sql"):
            old.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = await conn.fetch("""
        SELECT p.id, nr.name
        FROM profile_artifact p
        JOIN profile_names_junction pnj ON pnj.profile_id = p.id
        JOIN names_resource nr ON nr.id = pnj.name_id
        WHERE nr.name ILIKE 'Default %'
          AND nr.name NOT ILIKE '%benchmark%'
        ORDER BY nr.name
    """)
    artifacts = [(str(r["id"]), r["name"]) for r in rows]
    all_junctions = await get_junction_tables(conn, "profile")
    # Exclude section-specific junctions (exported per setup)
    base_junctions = [
        j
        for j in all_junctions
        if j
        not in (
            "profile_departments_junction",
            "profile_emails_junction",
            "profile_cohorts_junction",
        )
    ]

    for art_id, art_name in artifacts:
        slug = to_slug(art_name)
        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: profile\n"
            f"-- Description: {art_name} base profile\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "profile", art_id, base_junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


async def export_base_settings(conn: asyncpg.Connection) -> None:
    """Export settings not linked to any department to 10-settings/.

    Settings linked to departments are exported at the setup level
    (11-setups/university/10-settings/) instead.
    """
    print("Exporting 10-settings/ ...")
    out_dir = MODULES_DIR / "10-settings"
    # Clean up old files (settings may have moved to setup level)
    if out_dir.exists():
        for old in out_dir.glob("*.sql"):
            old.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = await conn.fetch("""
        SELECT sa.id, nr.name
        FROM setting_artifact sa
        JOIN setting_names_junction snj ON snj.setting_id = sa.id
        JOIN names_resource nr ON nr.id = snj.name_id
        WHERE NOT EXISTS (
            SELECT 1 FROM setting_settings_junction ssj
            JOIN departments_resource dr ON ssj.settings_id = ANY(dr.setting_ids)
            WHERE ssj.setting_id = sa.id
        )
        ORDER BY nr.name
    """)
    artifacts = [(str(r["id"]), r["name"]) for r in rows]
    junctions = await get_junction_tables(conn, "setting")

    for art_id, art_name in artifacts:
        slug = to_slug(art_name)
        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: setting\n"
            f"-- Description: {art_name} base setting\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "setting", art_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


async def export_setup_departments(conn: asyncpg.Connection) -> None:
    """Export active non-General departments to university, General to root."""
    # General → 11-setups/organization/01-departments/
    # Non-General active → 11-setups/university/01-departments/
    org_dir = MODULES_DIR / "11-setups" / "organization" / "01-departments"
    univ_dir = MODULES_DIR / "11-setups" / "university" / "01-departments"
    for d in (org_dir, univ_dir):
        if d.exists():
            for old in d.glob("*.sql"):
                old.unlink()

    rows = await conn.fetch("""
        SELECT a.id, nr.name
        FROM department_artifact a
        JOIN department_names_junction nj ON a.id = nj.department_id
        JOIN names_resource nr ON nj.name_id = nr.id
        WHERE EXISTS (
            SELECT 1 FROM department_flags_junction af
            JOIN flags_resource f ON f.id = af.flag_id
            WHERE af.department_id = a.id AND f.name = 'department_active' AND af.value = true
        )
        ORDER BY nr.name
    """)
    junctions = await get_junction_tables(conn, "department")

    for r in rows:
        art_id = str(r["id"])
        art_name = r["name"]
        slug = to_slug(art_name).replace(",", "")

        if art_name.lower() == "general":
            out_dir = MODULES_DIR / "11-setups" / "organization" / "01-departments"
            label = "organization"
        else:
            out_dir = MODULES_DIR / "11-setups" / "university" / "01-departments"
            label = "university"
        out_dir.mkdir(parents=True, exist_ok=True)

        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: department ({label})\n"
            f"-- Description: {art_name} department\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "department", art_id, junctions, output_path, header
        )
        print(f"    {output_path.relative_to(MODULES_DIR)} ({count} inserts)")


async def export_setup_profiles(conn: asyncpg.Connection) -> None:
    """Export section-specific profile links (departments + emails + cohorts).

    Each setup section gets its own profile_departments_junction and
    profile_emails_junction rows:
      organization/09-profiles/ → General dept + @gmail.com emails
      university/09-profiles/   → Purdue CS dept + @purdue.edu emails + cohort links
    """
    # Clean up both locations
    for loc in ("organization", "university"):
        old_dir = MODULES_DIR / "11-setups" / loc / "09-profiles"
        if old_dir.exists():
            for old in old_dir.glob("*.sql"):
                old.unlink()

    # Get default profile artifact IDs
    rows = await conn.fetch("""
        SELECT p.id, nr.name
        FROM profile_artifact p
        JOIN profile_names_junction pnj ON pnj.profile_id = p.id
        JOIN names_resource nr ON nr.id = pnj.name_id
        WHERE nr.name ILIKE 'Default %'
          AND nr.name NOT ILIKE '%benchmark%'
        ORDER BY nr.name
    """)
    artifacts = [(str(r["id"]), r["name"]) for r in rows]

    # Get department sections: General → organization, others → university
    dept_rows = await conn.fetch("""
        SELECT dr.id, dr.name
        FROM departments_resource dr
        JOIN department_departments_junction ddj ON ddj.departments_id = dr.id AND ddj.active = true
        JOIN department_flags_junction dfl ON dfl.department_id = ddj.department_id AND dfl.active = true
        JOIN flags_resource f ON f.id = dfl.flag_id AND f.name = 'department_active' AND dfl.value = true
        ORDER BY dr.name
    """)

    # Build section → department IDs mapping
    sections: dict[str, list[str]] = {"organization": [], "university": []}
    for dr in dept_rows:
        if dr["name"].lower() == "general":
            sections["organization"].append(str(dr["id"]))
        else:
            sections["university"].append(str(dr["id"]))

    # Email domain per section
    email_domains = {"organization": "@gmail.com", "university": "@purdue.edu"}

    dept_cols = TABLE_COLUMNS.get("profile_departments_junction", [])
    dept_pks = TABLE_PKS.get("profile_departments_junction", [])
    email_junction_cols = TABLE_COLUMNS.get("profile_emails_junction", [])
    email_junction_pks = TABLE_PKS.get("profile_emails_junction", [])
    email_res_cols = TABLE_COLUMNS.get("emails_resource", [])
    email_res_pks = TABLE_PKS.get("emails_resource", [])
    cohort_junction_cols = TABLE_COLUMNS.get("profile_cohorts_junction", [])
    cohort_junction_pks = TABLE_PKS.get("profile_cohorts_junction", [])
    cohort_res_cols = TABLE_COLUMNS.get("cohorts_resource", [])
    cohort_res_pks = TABLE_PKS.get("cohorts_resource", [])

    for section, dept_ids in sections.items():
        if not dept_ids:
            continue
        out_dir = MODULES_DIR / "11-setups" / section / "09-profiles"
        out_dir.mkdir(parents=True, exist_ok=True)
        domain = email_domains[section]

        print(f"  Exporting {section}/09-profiles/ ...")
        for art_id, art_name in artifacts:
            slug = to_slug(art_name)
            output_path = out_dir / f"{slug}.sql"
            header = (
                f"-- Module: {art_name}\n"
                f"-- Category: profile ({section})\n"
                f"-- Description: {art_name} profile — {section} links\n"
                f"-- ============================================================\n\n"
            )
            count = 0
            with open(output_path, "w") as f:
                f.write(header)

                # Department links for this section
                dept_col_list = ", ".join(dept_cols)
                for did in dept_ids:
                    dept_row = await conn.fetchrow(
                        f"SELECT {dept_col_list} FROM public.profile_departments_junction "
                        f"WHERE profile_id = $1 AND department_id = $2",
                        UUID(art_id),
                        UUID(did),
                    )
                    if dept_row:
                        if count == 0:
                            f.write("-- profile_departments_junction\n")
                        f.write(
                            make_insert(
                                "profile_departments_junction",
                                dept_row,
                                dept_cols,
                                dept_pks,
                            )
                            + "\n"
                        )
                        count += 1

                # Email links for this section (filtered by domain)
                email_col_list = ", ".join(email_junction_cols)
                email_rows = await conn.fetch(
                    f"SELECT {email_col_list} FROM public.profile_emails_junction "
                    f"WHERE profile_id = $1 AND email LIKE $2",
                    UUID(art_id),
                    f"%{domain}",
                )
                if email_rows:
                    # First write the emails_resource rows
                    f.write("-- emails_resource\n")
                    eres_col_list = ", ".join(email_res_cols)
                    for erow in email_rows:
                        eres_row = await conn.fetchrow(
                            f"SELECT {eres_col_list} FROM public.emails_resource WHERE id = $1",
                            erow["email_id"],
                        )
                        if eres_row:
                            f.write(
                                make_insert(
                                    "emails_resource",
                                    eres_row,
                                    email_res_cols,
                                    email_res_pks,
                                )
                                + "\n"
                            )
                            count += 1

                    f.write("-- profile_emails_junction\n")
                    for erow in email_rows:
                        f.write(
                            make_insert(
                                "profile_emails_junction",
                                erow,
                                email_junction_cols,
                                email_junction_pks,
                            )
                            + "\n"
                        )
                        count += 1

                # Cohort links (university section only)
                if section == "university" and cohort_junction_cols:
                    cohort_col_list = ", ".join(cohort_junction_cols)
                    cohort_rows = await conn.fetch(
                        f"SELECT {cohort_col_list} FROM public.profile_cohorts_junction "
                        f"WHERE profile_id = $1",
                        UUID(art_id),
                    )
                    if cohort_rows:
                        # First write the cohorts_resource rows
                        seen_cohort_ids: set[str] = set()
                        f.write("-- cohorts_resource\n")
                        cres_col_list = ", ".join(cohort_res_cols)
                        for crow in cohort_rows:
                            cid = str(crow["cohort_id"])
                            if cid in seen_cohort_ids:
                                continue
                            seen_cohort_ids.add(cid)
                            cres_row = await conn.fetchrow(
                                f"SELECT {cres_col_list} FROM public.cohorts_resource WHERE id = $1",
                                crow["cohort_id"],
                            )
                            if cres_row:
                                f.write(
                                    make_insert(
                                        "cohorts_resource",
                                        cres_row,
                                        cohort_res_cols,
                                        cohort_res_pks,
                                    )
                                    + "\n"
                                )
                                count += 1

                        f.write("-- profile_cohorts_junction\n")
                        for crow in cohort_rows:
                            f.write(
                                make_insert(
                                    "profile_cohorts_junction",
                                    crow,
                                    cohort_junction_cols,
                                    cohort_junction_pks,
                                )
                                + "\n"
                            )
                            count += 1

            print(f"    {slug}.sql ({count} inserts)")


async def export_setup_settings(conn: asyncpg.Connection) -> None:
    """Export settings linked to departments.

    General Settings → 11-setups/organization/10-settings/
    Non-General → 11-setups/university/10-settings/
    """
    org_dir = MODULES_DIR / "11-setups" / "organization" / "10-settings"
    univ_dir = MODULES_DIR / "11-setups" / "university" / "10-settings"
    for d in (org_dir, univ_dir):
        if d.exists():
            for old in d.glob("*.sql"):
                old.unlink()

    rows = await conn.fetch("""
        SELECT sa.id, nr.name
        FROM setting_artifact sa
        JOIN setting_names_junction snj ON snj.setting_id = sa.id
        JOIN names_resource nr ON nr.id = snj.name_id
        WHERE EXISTS (
            SELECT 1 FROM setting_settings_junction ssj
            JOIN departments_resource dr ON ssj.settings_id = ANY(dr.setting_ids)
            WHERE ssj.setting_id = sa.id
        )
        ORDER BY nr.name
    """)
    junctions = await get_junction_tables(conn, "setting")

    for r in rows:
        art_id = str(r["id"])
        art_name = r["name"]
        slug = to_slug(art_name)

        if art_name.lower().startswith("general"):
            out_dir = org_dir
            label = "organization"
        else:
            out_dir = univ_dir
            label = "university"
        out_dir.mkdir(parents=True, exist_ok=True)

        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: setting ({label})\n"
            f"-- Description: {art_name} setting\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "setting", art_id, junctions, output_path, header
        )
        print(f"    {output_path.relative_to(MODULES_DIR)} ({count} inserts)")


async def _get_scenario_artifact_ids_for_simulation(
    conn: asyncpg.Connection, sim_id: str
) -> list[str]:
    """
    Get scenario_artifact IDs for a simulation.
    Scenarios are linked via simulations_resource.scenario_ids (array of scenarios_resource.id),
    then scenario_scenarios_junction maps scenarios_resource.id → scenario_artifact.id.
    """
    # Step 1: Get the simulations_resource for this simulation
    sim_res = await conn.fetchrow(
        """
        SELECT sr.scenario_ids
        FROM simulations_resource sr
        JOIN simulation_simulations_junction ssj ON ssj.simulations_id = sr.id
        WHERE ssj.simulation_id = $1
        LIMIT 1
    """,
        UUID(sim_id),
    )

    if not sim_res or not sim_res["scenario_ids"]:
        return []

    scenario_resource_ids = sim_res["scenario_ids"]

    # Step 2: For each scenarios_resource.id, find the scenario_artifact via scenario_scenarios_junction
    artifact_ids = []
    for scn_res_id in scenario_resource_ids:
        row = await conn.fetchrow(
            """
            SELECT scenario_id FROM scenario_scenarios_junction
            WHERE scenarios_id = $1
            LIMIT 1
        """,
            scn_res_id,
        )
        if row:
            artifact_ids.append(str(row["scenario_id"]))
    return artifact_ids


async def export_setup_simulations(conn: asyncpg.Connection) -> None:
    """Export simulations with inline scenarios."""
    print("  Exporting 06-simulations/ ...")
    sim_dir = MODULES_DIR / "11-setups" / "university" / "06-simulations"
    if sim_dir.exists():
        for old in sim_dir.glob("*.sql"):
            old.unlink()
    sim_dir.mkdir(parents=True, exist_ok=True)

    practice_names = {
        "general practice",
        "aggressive practice",
        "confused practice",
        "happy practice",
        "passive practice",
        "video practice",
    }
    all_sims = await get_artifacts_with_names(conn, "simulation")
    sim_artifacts = [
        (sid, sname) for sid, sname in all_sims if sname.lower() in practice_names
    ]
    sim_junctions = await get_junction_tables(conn, "simulation")
    scn_junctions = await get_junction_tables(conn, "scenario")

    for sim_id, sim_name in sim_artifacts:
        slug = to_slug(sim_name)
        output_path = sim_dir / f"{slug}.sql"

        seen = set()
        with open(output_path, "w") as f:
            f.write(f"-- Module: {sim_name}\n")
            f.write("-- Category: simulation\n")
            f.write(f"-- Description: {sim_name} simulation with inline scenarios\n")
            f.write("-- ============================================================\n")

            # Simulation resource rows
            f.write("\n-- Simulation resource rows\n")
            await export_resource_rows_for_artifact(
                conn, "simulation", sim_id, sim_junctions, f, seen
            )

            # Get linked scenario artifact IDs via simulations_resource.scenario_ids
            scn_artifact_ids = await _get_scenario_artifact_ids_for_simulation(
                conn, sim_id
            )

            if scn_artifact_ids:
                # Scenario resource rows
                f.write("\n-- Scenario resource rows\n")
                for scn_id in scn_artifact_ids:
                    await export_resource_rows_for_artifact(
                        conn, "scenario", scn_id, scn_junctions, f, seen
                    )

                # Scenario artifacts
                f.write("\n-- Scenario artifacts\n")
                for scn_id in scn_artifact_ids:
                    await export_artifact_row(conn, "scenario", scn_id, f)

                # Scenario junctions
                f.write("\n-- Scenario junctions\n")
                for scn_id in scn_artifact_ids:
                    await export_junction_rows_for_artifact(
                        conn, "scenario", scn_id, scn_junctions, f
                    )

            # Simulation artifact
            f.write("\n-- Simulation artifact\n")
            await export_artifact_row(conn, "simulation", sim_id, f)

            # Simulation junctions
            f.write("\n-- Simulation junctions\n")
            await export_junction_rows_for_artifact(
                conn, "simulation", sim_id, sim_junctions, f
            )

        count = sum(
            1
            for line in output_path.read_text().splitlines()
            if line.startswith("INSERT INTO")
        )
        print(f"    {slug}.sql ({count} inserts)")


async def export_setup_scenarios(conn: asyncpg.Connection) -> None:
    """Export scenarios linked to the 6 practice simulations."""
    print("  Exporting 07-scenarios/ ...")
    scn_dir = MODULES_DIR / "11-setups" / "university" / "07-scenarios"
    if scn_dir.exists():
        for old in scn_dir.glob("*.sql"):
            old.unlink()
    scn_dir.mkdir(parents=True, exist_ok=True)

    practice_names = {
        "general practice",
        "aggressive practice",
        "confused practice",
        "happy practice",
        "passive practice",
        "video practice",
    }
    all_sims = await get_artifacts_with_names(conn, "simulation")
    practice_sims = [
        (sid, sname) for sid, sname in all_sims if sname.lower() in practice_names
    ]

    # Collect unique scenario artifact IDs across all practice sims
    seen_scenario_ids: set[str] = set()
    for sim_id, _ in practice_sims:
        scn_ids = await _get_scenario_artifact_ids_for_simulation(conn, sim_id)
        seen_scenario_ids.update(scn_ids)

    # Get names for each scenario
    junctions = await get_junction_tables(conn, "scenario")
    for scn_id in sorted(seen_scenario_ids):
        row = await conn.fetchrow(
            """
            SELECT nr.name
            FROM scenario_names_junction snj
            JOIN names_resource nr ON nr.id = snj.name_id
            WHERE snj.scenario_id = $1
        """,
            UUID(scn_id),
        )
        if not row:
            continue
        scn_name = row["name"]
        slug = to_slug(scn_name).replace(",", "")
        output_path = scn_dir / f"{slug}.sql"
        header = (
            f"-- Module: {scn_name}\n"
            f"-- Category: scenario\n"
            f"-- Description: {scn_name} scenario\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "scenario", scn_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


async def export_setup_documents(conn: asyncpg.Connection) -> None:
    """Export documents with no department (shared templates/policies)."""
    print("  Exporting 03-documents/ ...")
    out_dir = MODULES_DIR / "11-setups" / "university" / "03-documents"
    if out_dir.exists():
        for old in out_dir.glob("*.sql"):
            old.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = await conn.fetch("""
        SELECT da.id, nr.name
        FROM document_artifact da
        JOIN document_names_junction dnj ON dnj.document_id = da.id
        JOIN names_resource nr ON nr.id = dnj.name_id
        WHERE NOT EXISTS (
            SELECT 1 FROM document_departments_junction ddj WHERE ddj.document_id = da.id
        )
        ORDER BY nr.name
    """)
    artifacts = [(str(r["id"]), r["name"]) for r in rows]
    junctions = await get_junction_tables(conn, "document")

    for art_id, art_name in artifacts:
        slug = to_slug(art_name).replace(",", "")
        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: document\n"
            f"-- Description: {art_name} document\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "document", art_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


async def export_setup_fields(conn: asyncpg.Connection) -> None:
    """Export fields linked to Purdue CS or with no department."""
    print("  Exporting 04-fields/ ...")
    out_dir = MODULES_DIR / "11-setups" / "university" / "04-fields"
    if out_dir.exists():
        for old in out_dir.glob("*.sql"):
            old.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = await conn.fetch("""
        SELECT fa.id, nr.name
        FROM field_artifact fa
        JOIN field_names_junction fnj ON fnj.field_id = fa.id
        JOIN names_resource nr ON nr.id = fnj.name_id
        WHERE NOT EXISTS (
            SELECT 1 FROM field_departments_junction fdj WHERE fdj.field_id = fa.id
        )
        OR EXISTS (
            SELECT 1 FROM field_departments_junction fdj
            JOIN department_departments_junction ddj ON ddj.departments_id = fdj.department_id
            JOIN department_names_junction dnj ON dnj.department_id = ddj.department_id
            JOIN names_resource dnr ON dnr.id = dnj.name_id
            WHERE fdj.field_id = fa.id AND dnr.name = 'Purdue CS'
        )
        ORDER BY nr.name
    """)
    artifacts = [(str(r["id"]), r["name"]) for r in rows]
    junctions = await get_junction_tables(conn, "field")

    for art_id, art_name in artifacts:
        slug = to_slug(art_name).replace(",", "")
        output_path = out_dir / f"{slug}.sql"
        header = (
            f"-- Module: {art_name}\n"
            f"-- Category: field\n"
            f"-- Description: {art_name} field\n"
            f"-- ============================================================\n\n"
        )
        count = await write_artifact_module(
            conn, "field", art_id, junctions, output_path, header
        )
        print(f"    {slug}.sql ({count} inserts)")


async def export_uploads(conn: asyncpg.Connection) -> None:
    """Export uploads_entry + uploads_uploads_connection for documents with uploads.

    Also copies the actual upload files to the module's files/ directory.
    """
    print("  Exporting uploads/ ...")
    out_dir = MODULES_DIR / "11-setups" / "university" / "uploads"
    if out_dir.exists():
        for old in out_dir.glob("*.sql"):
            old.unlink()
    files_dir = out_dir / "files"
    if files_dir.exists():
        for old in files_dir.iterdir():
            old.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)
    files_dir.mkdir(parents=True, exist_ok=True)

    # Find document artifacts with no department (same filter as export_setup_documents)
    # that have uploads linked via document_uploads_junction
    rows = await conn.fetch("""
        SELECT DISTINCT da.id, nr.name, duj.uploads_id
        FROM document_artifact da
        JOIN document_names_junction dnj ON dnj.document_id = da.id
        JOIN names_resource nr ON nr.id = dnj.name_id
        JOIN document_uploads_junction duj ON duj.document_id = da.id AND duj.active = true
        WHERE NOT EXISTS (
            SELECT 1 FROM document_departments_junction ddj WHERE ddj.document_id = da.id
        )
        ORDER BY nr.name
    """)

    if not rows:
        print("    uploads.sql (0 inserts, 0 files)")
        return

    entry_cols = TABLE_COLUMNS.get("uploads_entry", [])
    entry_pks = TABLE_PKS.get("uploads_entry", [])
    conn_cols = TABLE_COLUMNS.get("uploads_uploads_connection", [])
    conn_pks = TABLE_PKS.get("uploads_uploads_connection", [])

    output_path = out_dir / "uploads.sql"
    seen_entry_ids: set[str] = set()
    seen_conn_keys: set[tuple[str, str]] = set()
    copied_files: set[str] = set()
    upload_source = PROJECT_ROOT / "uploads"

    with open(output_path, "w") as f:
        f.write("-- Module: uploads\n")
        f.write("-- Category: uploads\n")
        f.write("-- Description: Upload entries and connections for document uploads\n")
        f.write("-- ============================================================\n")

        # Collect uploads_entry and uploads_uploads_connection rows
        entry_inserts: list[str] = []
        conn_inserts: list[str] = []

        for r in rows:
            uploads_id = r["uploads_id"]

            # Get uploads_uploads_connection rows for this uploads_resource
            conn_col_list = ", ".join(conn_cols)
            conn_rows = await conn.fetch(
                f"SELECT {conn_col_list} FROM public.uploads_uploads_connection WHERE uploads_id = $1",
                uploads_id,
            )

            for crow in conn_rows:
                upload_id = crow["upload_id"]
                upload_id_str = str(upload_id)

                # Export uploads_entry (deduplicated)
                if upload_id_str not in seen_entry_ids:
                    seen_entry_ids.add(upload_id_str)
                    entry_col_list = ", ".join(entry_cols)
                    entry_row = await conn.fetchrow(
                        f"SELECT {entry_col_list} FROM public.uploads_entry WHERE id = $1",
                        upload_id,
                    )
                    if entry_row:
                        entry_inserts.append(
                            make_insert("uploads_entry", entry_row, entry_cols, entry_pks)
                        )
                        # Copy the actual file
                        file_path = entry_row["file_path"]
                        if file_path and file_path not in copied_files:
                            src = upload_source / file_path
                            if src.exists():
                                shutil.copy2(src, files_dir / file_path)
                                copied_files.add(file_path)
                            else:
                                print(f"    WARNING: Upload file not found: {src}")

                # Export uploads_uploads_connection (deduplicated)
                conn_key = (str(uploads_id), upload_id_str)
                if conn_key not in seen_conn_keys:
                    seen_conn_keys.add(conn_key)
                    conn_inserts.append(
                        make_insert("uploads_uploads_connection", crow, conn_cols, conn_pks)
                    )

        # Write entry rows first (referenced by connections)
        if entry_inserts:
            f.write("\n-- uploads_entry\n")
            for stmt in entry_inserts:
                f.write(stmt + "\n")

        # Then connection rows
        if conn_inserts:
            f.write("\n-- uploads_uploads_connection\n")
            for stmt in conn_inserts:
                f.write(stmt + "\n")

    total = len(entry_inserts) + len(conn_inserts)
    print(f"    uploads.sql ({total} inserts, {len(copied_files)} files)")


async def export_setup(conn: asyncpg.Connection) -> None:
    print("Exporting 11-setups/ ...")
    await export_setup_departments(conn)
    await export_setup_per_artifact(conn, "persona", "02-personas", "persona")
    await export_setup_documents(conn)
    await export_uploads(conn)
    await export_setup_fields(conn)
    await export_setup_per_artifact(conn, "parameter", "05-parameters", "parameter")
    await export_rubrics(conn)
    await export_setup_simulations(conn)
    await export_setup_scenarios(conn)
    await export_setup_per_artifact(
        conn, "cohort", "08-cohorts", "cohort", filter_name="Practice Cohort"
    )
    await export_setup_profiles(conn)
    await export_setup_settings(conn)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main() -> None:
    target = sys.argv[1] if len(sys.argv) > 1 else "all"

    conn = await asyncpg.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
    )

    try:
        print("Loading metadata ...")
        await load_metadata(conn)
        print(
            f"  {len(TABLE_COLUMNS)} tables, {len(TABLE_PKS)} PKs, {len(FK_MAP)} FK constraints"
        )
        print()

        dispatch: dict[str, Any] = {
            "relations": export_relations,
            "resources": export_resources,
            "providers": export_providers,
            "models": export_models,
            "agents": export_agents,
            "tools": export_tools,
            "auth": export_auth,
            "rubrics": export_rubrics,
            "evals": export_evals,
            "profiles": export_base_profiles,
            "settings": export_base_settings,
            "uploads": export_uploads,
            "setup": export_setup,
        }

        if target == "all":
            print("=== Exporting all modular seed data ===\n")
            await export_relations(conn)
            print()
            await export_resources(conn)
            print()
            await export_providers(conn)
            print()
            await export_models(conn)
            print()
            await export_agents(conn)
            print()
            await export_tools(conn)
            print()
            await export_auth(conn)
            print()
            await export_rubrics(conn)
            print()
            await export_evals(conn)
            print()
            await export_base_profiles(conn)
            print()
            await export_base_settings(conn)
            print()
            await export_setup(conn)
            print()
            print("=== Export complete ===")
            print(f"Module files are in: {MODULES_DIR}/")
        elif target in dispatch:
            await dispatch[target](conn)
        else:
            print(
                f"Usage: {sys.argv[0]} {{all|relations|resources|providers|models|agents|tools|auth|setup}}"
            )
            print()
            print("  all       - Export all modules (default)")
            print("  relations - Export 00-relations/")
            print("  resources - Export 01-resources/")
            print("  providers - Export 02-providers/")
            print("  models    - Export 03-models/")
            print("  agents    - Export 04-agents/")
            print("  tools     - Export 05-tools/")
            print("  auth      - Export 06-auth/")
            print("  setup     - Export 11-setups/")
            sys.exit(1)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
