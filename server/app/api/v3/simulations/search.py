"""Simulation search endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_pool
from app.main import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class FindSimulationsRequest(BaseModel):
    """Request to search simulations."""

    query: str
    limit: int = 10


class SimulationSearchResult(BaseModel):
    """Simulation search result."""

    id: str
    title: str | None
    active: bool
    time_limit: int | None
    created_at: str | None
    score: int


@router.post("/search", response_model=list[SimulationSearchResult])
@server.tool()
async def find_simulations(
    request: FindSimulationsRequest,
) -> list[SimulationSearchResult]:
    """
    🔎 Find simulations by title
    ----------------------------
    Fuzzy sim title search.

    Input
      • query - Simulation title to search for
      • limit - Max results (default: 10)

    Returns
      [
        {
          "id": str,                # Simulation UUID
          "title": str | None,      # Simulation title
          "active": bool,           # Is the simulation active?
          "time_limit": int | None, # Time limit in minutes (if any)
          "created_at": str | None, # ISO8601 creation timestamp
          "score": int              # Heuristic match score
        },
        ...
      ]

    Quick-start
      ask:  "Which sims mention 'cardiac'?"
      call: await find_simulations("cardiac")

    See also 👉 simulation_overview() for detailed sim data.
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database connection pool not available")

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/simulations/search.sql")
            rows = await conn.fetch(sql, request.query, request.limit)

            results = []
            for row in rows:
                results.append(
                    SimulationSearchResult(
                        id=str(row["id"]),
                        title=row["title"],
                        active=row["active"],
                        time_limit=row["time_limit"],
                        created_at=row["created_at"].isoformat()
                        if row["created_at"]
                        else None,
                        score=int(row["score"]),
                    )
                )

            return results
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Search error: {str(e)}"
        )

