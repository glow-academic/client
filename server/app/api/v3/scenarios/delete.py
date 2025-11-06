"""Scenario delete endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteScenarioResponse:
    """Delete a scenario."""
    tags = ["scenarios"]  # From router tags
    try:
        # Delete scenario with existence and usage checks in a single SQL file
        sql = load_sql("sql/v3/scenarios/delete_scenario_complete.sql")
        result = await conn.fetchrow(sql, request.scenarioId)

        if not result:
            # Scenario doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Scenario not found: {request.scenarioId}"
            )

        # Check if scenario was deleted or is in use
        if not result["deleted"]:
            # Scenario exists but is in use
            usage_count = result["usage_count"]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete scenario that is in use by {usage_count} simulation(s)",
            )

        result_data = DeleteScenarioResponse(
            success=True,
            message=f"Scenario '{result['name']}' deleted successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

