"""Model artifact SEARCH — returns matching model IDs."""

from uuid import UUID

import asyncpg

from app.infra.search.search_artifact import (
    add_junction_filter,
    execute_artifact_search,
)

TABLE = "model_artifact"
OWNER_COL = "model_id"


async def search_models(
    conn: asyncpg.Connection,
    *,
    search: str | None = None,
    department_ids: list[UUID] | None = None,
    provider_ids: list[UUID] | None = None,
    exclude_ids: list[UUID] | None = None,
    active_only: bool = True,
    limit_count: int = 20,
    offset_count: int = 0,
) -> list[UUID]:
    """Search model artifacts by filters. Returns IDs only."""
    conditions: list[str] = []
    params: list[object] = []
    idx = 1

    if active_only:
        conditions.append("a.active = true")

    # Text search across name and description
    if search:
        # OR across both text junctions
        conditions.append(
            f"("
            f"EXISTS ("
            f"SELECT 1 FROM model_names_junction nj "
            f"JOIN names_resource nr ON nr.id = nj.names_id "
            f"WHERE nj.{OWNER_COL} = a.id AND nj.active = true "
            f"AND LOWER(nr.name) LIKE '%%' || LOWER(${idx}) || '%%'"
            f") OR EXISTS ("
            f"SELECT 1 FROM model_descriptions_junction dj "
            f"JOIN descriptions_resource dr ON dr.id = dj.descriptions_id "
            f"WHERE dj.{OWNER_COL} = a.id AND dj.active = true "
            f"AND LOWER(dr.description) LIKE '%%' || LOWER(${idx}) || '%%'"
            f")"
            f")"
        )
        params.append(search)
        idx += 1

    # Junction filters
    if department_ids:
        idx = add_junction_filter(
            conditions, params, idx,
            junction_table="model_departments_junction",
            owner_col=OWNER_COL, resource_col="departments_id",
            ids=department_ids,
        )

    if provider_ids:
        idx = add_junction_filter(
            conditions, params, idx,
            junction_table="model_providers_junction",
            owner_col=OWNER_COL, resource_col="providers_id",
            ids=provider_ids,
        )

    # Exclude
    if exclude_ids:
        conditions.append(f"NOT (a.id = ANY(${idx}))")
        params.append(exclude_ids)
        idx += 1

    # Order by name (LEFT JOIN for sorting)
    order_join = (
        f"LEFT JOIN model_names_junction pnj ON pnj.{OWNER_COL} = a.id AND pnj.active = true "
        f"LEFT JOIN names_resource nr_sort ON nr_sort.id = pnj.names_id"
    )

    return await execute_artifact_search(
        conn,
        table=TABLE,
        conditions=conditions,
        params=params,
        idx=idx,
        order_join=order_join,
        order_expr="MIN(nr_sort.name) NULLS LAST",
        limit_count=limit_count,
        offset_count=offset_count,
    )
