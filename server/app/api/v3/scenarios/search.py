"""Scenario search endpoint - v3 API."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import get_pool, server
from app.utils.sql_helper import load_sql

router = APIRouter()


class FindScenariosRequest(BaseModel):
    """Request to search scenarios."""

    query: str
    limit: int = 10


class ScenarioSearchResult(BaseModel):
    """Scenario search result."""

    id: str
    name: str | None
    problem_statement: str | None
    persona_id: str | None
    default_scenario: bool
    score: int


@router.post("/search", response_model=list[ScenarioSearchResult])
@server.tool()
async def find_scenarios(
    request: FindScenariosRequest,
) -> list[ScenarioSearchResult]:
    """
    🔎 Find scenarios by name/problem_statement
    --------------------------------------------
    Fuzzy, case-insensitive search on scenario name and problem statement.

    Input
        • query - Scenario name or problem statement to search for
        • limit - Max results (default: 10)

    Returns
        [
            {
                "id": str,                       # Scenario UUID
                "name": str | None,              # Scenario name/title
                "problem_statement": str | None, # Scenario problem statement
                "persona_id": str | None,        # Linked persona UUID (if any)
                "default_scenario": bool,        # Is this the default scenario?
                "score": int                     # Heuristic match score
            },
            ...
        ]

    Quick-start
        ask:  "Find scenarios for medication errors"
        call: await find_scenarios("medication error")

    See also 👉 scenario_overview() for detailed scenario data.
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/scenarios/search.sql")
            rows = await conn.fetch(sql, request.query, request.limit)

            results = []
            for row in rows:
                results.append(
                    ScenarioSearchResult(
                        id=str(row["id"]),
                        name=row["name"],
                        problem_statement=row["problem_statement"],
                        persona_id=str(row["persona_id"])
                        if row["persona_id"]
                        else None,
                        default_scenario=row["default_scenario"],
                        score=int(row["score"]),
                    )
                )

            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
