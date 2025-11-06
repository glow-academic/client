"""Scenario duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class DuplicateScenarioRequest(BaseModel):
    """Request to duplicate a scenario."""

    scenarioId: str


class DuplicateScenarioResponse(BaseModel):
    """Response from duplicate operation."""

    success: bool
    scenarioId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateScenarioResponse)
async def duplicate_scenario(
    request: DuplicateScenarioRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateScenarioResponse:
    """Duplicate a scenario."""
    tags = ["scenarios"]  # From router tags
    
    try:
        # Use single comprehensive SQL file (DHH style)
        duplicate_sql = load_sql("sql/v3/scenarios/duplicate_scenario.sql")
        new_scenario_row = await conn.fetchrow(duplicate_sql, request.scenarioId)

        if not new_scenario_row:
            raise HTTPException(status_code=404, detail=f"Scenario {request.scenarioId} not found")

        new_scenario_id = new_scenario_row["scenario_id"]

        # Get original name for message
        original_name = await conn.fetchval(
            "SELECT name FROM scenarios WHERE id = $1", request.scenarioId
        )

        result_data = DuplicateScenarioResponse(
            success=True,
            scenarioId=new_scenario_id,
            message=f"Scenario '{original_name}' duplicated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

