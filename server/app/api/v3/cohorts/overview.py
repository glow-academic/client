"""Cohort overview endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.mcp import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class CohortOverviewRequest(BaseModel):
    """Request to get cohort overview."""

    cohort_id: str


class CohortOverviewResponse(BaseModel):
    """Response with cohort overview data."""

    cohort: dict[str, Any]
    roster: list[dict[str, Any]]
    simulations: list[dict[str, Any]]
    stats: dict[str, Any]


@router.post("/overview", response_model=CohortOverviewResponse)
@server.tool()
async def cohort_overview(
    request: CohortOverviewRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortOverviewResponse:
    """
    🔎 Cohort overview
    ------------------
    Cohort meta, roster, active sims, pass-rate.

    Input
      • cohort_id – UUID of the cohort

    Returns
      { "cohort": { … }, "roster": [ … ], "simulations": [ … ], "stats": { … } }

    Quick-start
      ask:  "How's Fall 2025 Cohort A doing?"
      call: cohort_overview("uuid-here")

    See also 👉 cohort_pass_matrix() for detailed pass/fail data.
    """
    try:
        cohort_uuid = uuid.UUID(request.cohort_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid cohort_id format: {request.cohort_id}"
        )

    try:
        sql = load_sql("sql/v3/cohorts/overview.sql")
        result = await conn.fetchrow(sql, cohort_uuid)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Cohort not found: {request.cohort_id}"
            )

        cohort_data = {
            "id": str(result["id"]),
            "title": result["title"],
            "description": result["description"],
            "active": result["active"],
            "created_at": result["created_at"].isoformat()
            if result["created_at"]
            else None,
        }

        # Transform roster (jsonb array to list of dicts)
        roster = []
        roster_data = result["roster"]
        if isinstance(roster_data, str):
            roster_data = json.loads(roster_data)
        if roster_data and isinstance(roster_data, list):
            for profile in roster_data:
                roster.append(
                    {
                        "id": str(profile["id"]),
                        "first_name": profile["first_name"],
                        "last_name": profile["last_name"],
                        "alias": profile["alias"],
                        "role": profile["role"],
                    }
                )

        # Transform simulations (jsonb array to list of dicts)
        simulations_data = []
        simulations_raw = result["simulations"]
        if isinstance(simulations_raw, str):
            simulations_raw = json.loads(simulations_raw)
        if simulations_raw and isinstance(simulations_raw, list):
            for sim in simulations_raw:
                simulations_data.append(
                    {
                        "id": str(sim["id"]),
                        "title": sim["title"],
                        "active": sim["active"],
                        "time_limit": sim["time_limit"],
                    }
                )

        return CohortOverviewResponse(
            cohort=cohort_data,
            roster=roster,
            simulations=simulations_data,
            stats={
                "total_students": len(roster),
                "active_simulations": len(simulations_data),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

