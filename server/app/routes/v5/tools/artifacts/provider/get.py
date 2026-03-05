"""Provider artifact GET — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.provider.types import GetProvidersResponse

TABLE = "provider_artifact"

# (flag_name, junction_table, junction_column, response_field)
JUNCTIONS: list[tuple[str, str, str, str]] = [
    ("names", "provider_names_junction", "names_id", "name_ids"),
    ("descriptions", "provider_descriptions_junction", "descriptions_id", "description_ids"),
    ("departments", "provider_departments_junction", "departments_id", "department_ids"),
    ("flags", "provider_flags_junction", "flags_id", "flag_ids"),
    ("endpoints", "provider_endpoints_junction", "endpoints_id", "endpoint_ids"),
    ("keys", "provider_keys_junction", "keys_id", "key_ids"),
    ("values", "provider_values_junction", "values_id", "value_ids"),
    ("providers", "provider_providers_junction", "providers_id", "provider_ids"),
]


async def get_providers(
    conn: asyncpg.Connection,
    ids: list[UUID],
    *,
    names: bool = False,
    descriptions: bool = False,
    departments: bool = False,
    flags: bool = False,
    endpoints: bool = False,
    keys: bool = False,
    values: bool = False,
    providers: bool = False,
) -> list[GetProvidersResponse]:
    """Get provider artifacts by IDs with optional junction ID fetching."""
    if not ids:
        return []

    flags_map = {
        "names": names,
        "descriptions": descriptions,
        "departments": departments,
        "flags": flags,
        "endpoints": endpoints,
        "keys": keys,
        "values": values,
        "providers": providers,
    }

    active = [(table, col, field) for flag, table, col, field in JUNCTIONS if flags_map[flag]]

    columns = ["p.id", "p.created_at", "p.updated_at", "p.generated", "p.mcp", "p.active"]
    joins: list[str] = []

    for i, (table, col, field) in enumerate(active):
        alias = f"j{i}"
        joins.append(f"LEFT JOIN {table} {alias} ON {alias}.provider_id = p.id AND {alias}.active = true")
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
        results.append(GetProvidersResponse(**data))

    return results
