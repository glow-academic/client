"""Generate relation dicts from DB FK introspection + manual overrides."""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.registry.manual import (
    ARTIFACT_ROLES,
    ARTIFACT_VIEWS,
    TOOL_ENTRY_TYPES,
    VIEW_ENTRIES,
    VIEW_RESOURCES,
)

from .db import get_connection, group_by_key, invert_map, query_rows

# ---------------------------------------------------------------------------
# SQL for FK-based relation discovery
# ---------------------------------------------------------------------------

ARTIFACT_RESOURCES_SQL = """\
WITH junction_fks AS (
    SELECT tc.table_name AS junction,
           ccu.table_name AS referenced
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name LIKE '%%\\_junction'
      AND tc.table_name NOT LIKE '%%drafts%%'
      AND tc.table_name NOT LIKE '%%calls%%'
),
artifact_side AS (
    SELECT junction, replace(referenced, '_artifact', '') AS artifact
    FROM junction_fks WHERE referenced LIKE '%%_artifact'
),
resource_side AS (
    SELECT junction, replace(referenced, '_resource', '') AS resource
    FROM junction_fks WHERE referenced LIKE '%%_resource'
)
SELECT a.artifact, r.resource
FROM artifact_side a
JOIN resource_side r ON a.junction = r.junction
ORDER BY a.artifact, r.resource;
"""

ENTRY_RESOURCES_SQL = """\
WITH connection_fks AS (
    SELECT tc.table_name AS connection,
           ccu.table_name AS referenced
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name LIKE '%%\\_connection'
      AND tc.table_name NOT LIKE '%%drafts%%'
      AND tc.table_name NOT LIKE '%%resolved%%'
      AND tc.table_name NOT LIKE '%%calls%%'
),
entry_side AS (
    SELECT connection, replace(referenced, '_entry', '') AS entry
    FROM connection_fks WHERE referenced LIKE '%%_entry'
),
resource_side AS (
    SELECT connection, replace(referenced, '_resource', '') AS resource
    FROM connection_fks WHERE referenced LIKE '%%_resource'
)
SELECT e.entry, r.resource
FROM entry_side e
JOIN resource_side r ON e.connection = r.connection
ORDER BY e.entry, r.resource;
"""

ARTIFACT_FLAGS_SQL = """\
SELECT
    replace(j.table_name, '_flags_junction', '') AS artifact,
    f.name AS flag_name
FROM information_schema.tables j
JOIN information_schema.table_constraints tc
    ON tc.table_name = j.table_name AND tc.table_schema = j.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
JOIN flags_resource f ON true
WHERE j.table_schema = 'public'
    AND j.table_name LIKE '%%\\_flags\\_junction'
    AND j.table_name NOT LIKE '%%drafts%%'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name LIKE '%%_artifact'
GROUP BY j.table_name, f.name
HAVING EXISTS (
    SELECT 1 FROM flags_resource fr
    JOIN information_schema.table_constraints tc2
        ON tc2.table_name = j.table_name AND tc2.table_schema = 'public'
    JOIN information_schema.constraint_column_usage ccu2
        ON tc2.constraint_name = ccu2.constraint_name AND tc2.table_schema = ccu2.table_schema
    WHERE tc2.constraint_type = 'FOREIGN KEY'
        AND ccu2.table_name = 'flags_resource'
)
ORDER BY artifact, flag_name;
"""

# Simpler approach: query each artifact's flags junction directly
ARTIFACT_FLAGS_SIMPLE_SQL = """\
WITH flag_junctions AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name LIKE '%%\\_flags\\_junction'
        AND table_name NOT LIKE '%%drafts%%'
        AND table_type = 'BASE TABLE'
)
SELECT
    replace(fj.table_name, '_flags_junction', '') AS artifact
FROM flag_junctions fj
ORDER BY artifact;
"""

ARTIFACT_FLAG_NAMES_SQL = """\
SELECT DISTINCT f.name
FROM {junction_table} j
JOIN flags_resource f ON j.flags_id = f.id
WHERE f.active = true
ORDER BY f.name;
"""


def generate_artifact_flags(cur) -> dict[str, list[str]]:
    """Query distinct flag names per artifact from *_flags_junction tables."""
    # First, find all flag junction tables
    cur.execute(ARTIFACT_FLAGS_SIMPLE_SQL)
    artifacts = [row[0] for row in cur.fetchall()]

    result: dict[str, list[str]] = {}
    for artifact in artifacts:
        junction_table = f"{artifact}_flags_junction"
        try:
            cur.execute(
                f"SELECT DISTINCT f.name FROM {junction_table} j "
                f"JOIN flags_resource f ON j.flags_id = f.id "
                f"WHERE f.active = true ORDER BY f.name"
            )
            flags = [row[0] for row in cur.fetchall()]
            if flags:
                result[artifact] = flags
        except Exception:
            pass  # Junction table might not exist or have different structure

    return dict(sorted(result.items()))


def generate_resource_modalities(resource_keys: list[str]) -> dict[str, list[str]]:
    """Generate RESOURCE_MODALITIES — convention-based defaults + exceptions.

    All resources default to {"call"}, except:
    - documents → {"call", "document"}
    - images → {"call", "image"}
    - videos → {"call", "video"}

    Only resources that appear in the existing RESOURCE_MODALITIES are included
    (not all resource tables have modalities).
    """
    # Resources with extra modalities (naming convention: plural resource → singular modality)
    MODALITY_RESOURCES: dict[str, str] = {
        "documents": "document",
        "images": "image",
        "videos": "video",
    }

    result: dict[str, list[str]] = {}
    for key in sorted(resource_keys):
        modalities = ["call"]
        if key in MODALITY_RESOURCES:
            modalities.append(MODALITY_RESOURCES[key])
        result[key] = sorted(modalities)

    return result


def generate_all_relations(
    modality_resource_keys: list[str] | None = None,
) -> dict[str, dict[str, list[str] | frozenset[str]]]:
    """Generate all relation dicts. Returns a dict of dict name → data."""
    conn = get_connection()
    try:
        cur = conn.cursor()

        # FK-based relations
        ar_rows = query_rows(cur, ARTIFACT_RESOURCES_SQL)
        ar_grouped = group_by_key(ar_rows)

        er_rows = query_rows(cur, ENTRY_RESOURCES_SQL)
        er_grouped = group_by_key(er_rows)

        re_grouped = invert_map(er_grouped)

        # Artifact flags
        artifact_flags = generate_artifact_flags(cur)

        cur.close()
    finally:
        conn.close()

    # Resource modalities (convention-based, needs list of resource keys)
    if modality_resource_keys is None:
        # Use the keys from RESOURCE_MODALITIES in the current relations.py
        # This will be populated by the main script
        modality_resource_keys = []
    resource_modalities = generate_resource_modalities(modality_resource_keys)

    return {
        "ARTIFACT_FLAGS": artifact_flags,
        "ARTIFACT_ROLES": {k: sorted(v) for k, v in ARTIFACT_ROLES.items()},
        "ARTIFACT_RESOURCES": ar_grouped,
        "ENTRY_RESOURCES": er_grouped,
        "RESOURCE_ENTRIES": re_grouped,
        "RESOURCE_MODALITIES": resource_modalities,
        "VIEW_RESOURCES": {k: sorted(v) for k, v in VIEW_RESOURCES.items()},
        "ARTIFACT_VIEWS": {k: sorted(v) for k, v in ARTIFACT_VIEWS.items()},
        "VIEW_ENTRIES": {k: sorted(v) for k, v in VIEW_ENTRIES.items()},
        "TOOL_ENTRY_TYPES": dict(sorted(TOOL_ENTRY_TYPES.items())),
    }
