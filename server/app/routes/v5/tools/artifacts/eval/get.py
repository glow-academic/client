"""Eval artifact GET — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.eval.types import GetEvalsResponse

TABLE = "eval_artifact"

# (flag_name, junction_table, junction_column, response_field)
JUNCTIONS: list[tuple[str, str, str, str]] = [
    ("names", "eval_names_junction", "name_id", "name_ids"),
    ("descriptions", "eval_descriptions_junction", "description_id", "description_ids"),
    ("departments", "eval_departments_junction", "department_id", "department_ids"),
    ("flags", "eval_flags_junction", "flag_id", "flag_ids"),
    ("models", "eval_models_junction", "model_id", "model_ids"),
    ("model_flags", "eval_model_flags_junction", "model_flag_id", "model_flag_ids"),
    ("model_positions", "eval_model_positions_junction", "model_position_id", "model_position_ids"),
    ("model_rubrics", "eval_model_rubrics_junction", "model_rubric_id", "model_rubric_ids"),
    ("rubrics", "eval_rubrics_junction", "rubric_id", "rubric_ids"),
    ("evals", "eval_evals_junction", "evals_id", "eval_ids"),
]


async def get_evals(
    conn: asyncpg.Connection,
    ids: list[UUID],
    *,
    names: bool = False,
    descriptions: bool = False,
    departments: bool = False,
    flags: bool = False,
    models: bool = False,
    model_flags: bool = False,
    model_positions: bool = False,
    model_rubrics: bool = False,
    rubrics: bool = False,
    evals: bool = False,
) -> list[GetEvalsResponse]:
    """Get eval artifacts by IDs with optional junction ID fetching."""
    if not ids:
        return []

    flags_map = {
        "names": names,
        "descriptions": descriptions,
        "departments": departments,
        "flags": flags,
        "models": models,
        "model_flags": model_flags,
        "model_positions": model_positions,
        "model_rubrics": model_rubrics,
        "rubrics": rubrics,
        "evals": evals,
    }

    active = [(table, col, field) for flag, table, col, field in JUNCTIONS if flags_map[flag]]

    columns = ["p.id", "p.created_at", "p.updated_at", "p.generated", "p.mcp"]
    joins: list[str] = []

    for i, (table, col, field) in enumerate(active):
        alias = f"j{i}"
        joins.append(f"LEFT JOIN {table} {alias} ON {alias}.eval_id = p.id AND {alias}.active = true")
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
        results.append(GetEvalsResponse(**data))

    return results
