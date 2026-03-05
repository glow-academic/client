"""Setting artifact GET — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.setting.types import GetSettingsResponse

TABLE = "setting_artifact"

# (flag_name, junction_table, junction_column, response_field)
# NOTE: setting_auths_junction and setting_auth_values_junction use settings_id (plural)
# as their FK back to setting_artifact, not setting_id.
JUNCTIONS: list[tuple[str, str, str, str]] = [
    ("names", "setting_names_junction", "names_id", "name_ids"),
    ("descriptions", "setting_descriptions_junction", "descriptions_id", "description_ids"),
    ("departments", "setting_departments_junction", "departments_id", "department_ids"),
    ("flags", "setting_flags_junction", "flags_id", "flag_ids"),
    ("colors", "setting_colors_junction", "colors_id", "color_ids"),
    ("profiles", "setting_profiles_junction", "profiles_id", "profile_ids"),
    ("auth_item_keys", "setting_auth_item_keys_junction", "auth_item_keys_id", "auth_item_keys_ids"),
    ("provider_keys", "setting_provider_keys_junction", "provider_keys_id", "provider_key_ids"),
    ("thresholds", "setting_thresholds_junction", "thresholds_id", "threshold_ids"),
    ("systems", "setting_systems_junction", "systems_id", "systems_ids"),
    ("settings", "setting_settings_junction", "settings_id", "setting_ids"),
    ("auths", "setting_auths_junction", "auths_id", "auth_ids"),
    ("auth_values", "setting_auth_values_junction", "auths_id", "auth_value_ids"),
]

# Junctions that use `settings_id` (plural) as the FK back to setting_artifact
_SETTINGS_ID_TABLES = {"setting_auths_junction", "setting_auth_values_junction"}


async def get_settings(
    conn: asyncpg.Connection,
    ids: list[UUID],
    *,
    names: bool = False,
    descriptions: bool = False,
    departments: bool = False,
    flags: bool = False,
    colors: bool = False,
    profiles: bool = False,
    auth_item_keys: bool = False,
    provider_keys: bool = False,
    thresholds: bool = False,
    systems: bool = False,
    settings: bool = False,
    auths: bool = False,
    auth_values: bool = False,
) -> list[GetSettingsResponse]:
    """Get setting artifacts by IDs with optional junction ID fetching."""
    if not ids:
        return []

    flags_map = {
        "names": names,
        "descriptions": descriptions,
        "departments": departments,
        "flags": flags,
        "colors": colors,
        "profiles": profiles,
        "auth_item_keys": auth_item_keys,
        "provider_keys": provider_keys,
        "thresholds": thresholds,
        "systems": systems,
        "settings": settings,
        "auths": auths,
        "auth_values": auth_values,
    }

    active = [(table, col, field) for flag, table, col, field in JUNCTIONS if flags_map[flag]]

    # Build dynamic query
    columns = ["p.id", "p.created_at", "p.updated_at", "p.generated", "p.mcp", "p.active"]
    joins: list[str] = []

    for i, (table, col, field) in enumerate(active):
        alias = f"j{i}"
        fk = "settings_id" if table in _SETTINGS_ID_TABLES else "setting_id"
        joins.append(f"LEFT JOIN {table} {alias} ON {alias}.{fk} = p.id AND {alias}.active = true")
        columns.append(
            f"ARRAY_AGG(DISTINCT {alias}.{col}) FILTER (WHERE {alias}.{col} IS NOT NULL) AS {field}"
        )

    query = f"""
        SELECT {', '.join(columns)}
        FROM {TABLE} p
        {' '.join(joins)}
        WHERE p.id = ANY($1)
        GROUP BY p.id, p.created_at, p.updated_at, p.generated, p.mcp, p.active
    """

    rows = await conn.fetch(query, ids)

    results = []
    for r in rows:
        data: dict = {
            "id": r["id"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "generated": r["generated"],
            "mcp": r["mcp"],
            "active": r["active"],
        }
        for _, _, _, field in JUNCTIONS:
            if field in dict(r):
                data[field] = r[field] or []
        results.append(GetSettingsResponse(**data))

    return results
