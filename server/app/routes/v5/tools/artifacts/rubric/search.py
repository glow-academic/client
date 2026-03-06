"""Rubric artifact SEARCH — returns matching rubric IDs."""

from uuid import UUID

import asyncpg

from app.infra.search.search_artifact import (
    add_junction_filter,
    execute_artifact_search,
)

TABLE = "rubric_artifact"
OWNER_COL = "rubric_id"


async def search_rubrics(
    conn: asyncpg.Connection,
    *,
    search: str | None = None,
    department_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
    exclude_ids: list[UUID] | None = None,
    active_only: bool = True,
    limit_count: int = 20,
    offset_count: int = 0,
) -> list[UUID]:
    """Search rubric artifacts by filters. Returns IDs only."""
    conditions: list[str] = []
    params: list[object] = []
    idx = 1

    if active_only:
        conditions.append("a.active = true")

    # Text search across name and description
    if search:
        conditions.append(
            f"("
            f"EXISTS ("
            f"SELECT 1 FROM rubric_names_junction nj "
            f"JOIN names_resource nr ON nr.id = nj.names_id "
            f"WHERE nj.{OWNER_COL} = a.id AND nj.active = true "
            f"AND LOWER(nr.name) LIKE '%%' || LOWER(${idx}) || '%%'"
            f") OR EXISTS ("
            f"SELECT 1 FROM rubric_descriptions_junction dj "
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
            conditions,
            params,
            idx,
            junction_table="rubric_departments_junction",
            owner_col=OWNER_COL,
            resource_col="departments_id",
            ids=department_ids,
        )

    # Simulation filter — rubrics link to simulations through scenario_rubrics_resource
    if simulation_ids:
        conditions.append(
            f"EXISTS ("
            f"SELECT 1 FROM scenario_rubrics_resource srr "
            f"JOIN simulation_scenario_rubrics_junction ssr ON ssr.scenario_rubrics_id = srr.id "
            f"JOIN simulation_scenarios_junction ss ON ss.simulation_id = ssr.simulation_id "
            f"AND ss.scenarios_id = srr.scenario_id "
            f"WHERE srr.rubric_id = a.id "
            f"AND ss.simulation_id = ANY(${idx})"
            f")"
        )
        params.append(simulation_ids)
        idx += 1

    # Exclude
    if exclude_ids:
        conditions.append(f"NOT (a.id = ANY(${idx}))")
        params.append(exclude_ids)
        idx += 1

    # Order by name
    order_join = (
        f"LEFT JOIN rubric_names_junction pnj ON pnj.{OWNER_COL} = a.id AND pnj.active = true "
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
