"""Scenario delete endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class DeleteScenarioRequest(BaseModel):
    """Request to delete a scenario."""

    scenarioId: str


class DeleteScenarioResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteScenarioResponse)
async def delete_scenario(
    request: DeleteScenarioRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteScenarioResponse:
    """Delete a scenario."""
    try:
        async with transaction(conn):
            # Check if in use
            usage_sql = load_sql("sql/v3/scenarios/check_scenario_usage.sql")
            usage = await conn.fetchrow(usage_sql, request.scenarioId)

            if not usage:
                raise ValueError("Failed to check scenario usage")

            if usage["usage_count"] > 0:
                raise ValueError("Cannot delete scenario that is in use by simulations")

            # Get name for response
            name_sql = load_sql("sql/v3/scenarios/get_scenario_name.sql")
            scenario = await conn.fetchrow(name_sql, request.scenarioId)

            if not scenario:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

            # Delete scenario (cascades will handle junction tables)
            delete_sql = load_sql("sql/v3/scenarios/delete_scenario.sql")
            await conn.execute(delete_sql, request.scenarioId)

            return DeleteScenarioResponse(
                success=True,
                message=f"Scenario '{scenario['name']}' deleted successfully",
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

