"""Simulation artifact GET — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.simulation.types import GetSimulationsResponse

TABLE = "simulation_artifact"
ARTIFACT_FK = "simulation_id"

# (flag_name, junction_table, junction_column, response_field)
JUNCTIONS: list[tuple[str, str, str, str]] = [
    ("names", "simulation_names_junction", "name_id", "name_ids"),
    ("descriptions", "simulation_descriptions_junction", "description_id", "description_ids"),
    ("departments", "simulation_departments_junction", "department_id", "department_ids"),
    ("flags", "simulation_flags_junction", "flag_id", "flag_ids"),
    ("scenarios", "simulation_scenarios_junction", "scenario_id", "scenario_ids"),
    ("scenario_flags", "simulation_scenario_flags_junction", "scenario_flag_id", "scenario_flag_ids"),
    ("scenario_positions", "simulation_scenario_positions_junction", "scenario_position_id", "scenario_position_ids"),
    ("scenario_rubrics", "simulation_scenario_rubrics_junction", "scenario_rubric_id", "scenario_rubric_ids"),
    ("scenario_time_limits", "simulation_scenario_time_limits_junction", "scenario_time_limit_id", "scenario_time_limit_ids"),
    ("simulations", "simulation_simulations_junction", "simulations_id", "simulation_ids"),
]


async def get_simulations(
    conn: asyncpg.Connection,
    ids: list[UUID],
    *,
    names: bool = False,
    descriptions: bool = False,
    departments: bool = False,
    flags: bool = False,
    scenarios: bool = False,
    scenario_flags: bool = False,
    scenario_positions: bool = False,
    scenario_rubrics: bool = False,
    scenario_time_limits: bool = False,
    simulations: bool = False,
) -> list[GetSimulationsResponse]:
    """Get simulation artifacts by IDs with optional junction ID fetching."""
    if not ids:
        return []

    flags_map = {
        "names": names,
        "descriptions": descriptions,
        "departments": departments,
        "flags": flags,
        "scenarios": scenarios,
        "scenario_flags": scenario_flags,
        "scenario_positions": scenario_positions,
        "scenario_rubrics": scenario_rubrics,
        "scenario_time_limits": scenario_time_limits,
        "simulations": simulations,
    }

    active = [(table, col, field) for flag, table, col, field in JUNCTIONS if flags_map[flag]]

    # Build dynamic query
    columns = ["p.id", "p.created_at", "p.updated_at", "p.generated", "p.mcp"]
    joins: list[str] = []

    for i, (table, col, field) in enumerate(active):
        alias = f"j{i}"
        joins.append(f"LEFT JOIN {table} {alias} ON {alias}.{ARTIFACT_FK} = p.id AND {alias}.active = true")
        columns.append(
            f"ARRAY_AGG(DISTINCT {alias}.{col}) FILTER (WHERE {alias}.{col} IS NOT NULL) AS {field}"
        )

    query = f"""
        SELECT {', '.join(columns)}
        FROM {TABLE} p
        {' '.join(joins)}
        WHERE p.id = ANY($1)
        GROUP BY p.id, p.created_at, p.updated_at, p.generated, p.mcp
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
        }
        for _, _, _, field in JUNCTIONS:
            if field in dict(r):
                data[field] = r[field] or []
        results.append(GetSimulationsResponse(**data))

    return results
