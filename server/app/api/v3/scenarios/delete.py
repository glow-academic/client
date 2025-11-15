"""Scenario delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteScenarioResponse:
    """Delete a scenario."""
    tags = ["scenarios"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Delete scenario with existence and usage checks in a single SQL file
        sql_query = load_sql("sql/v3/scenarios/delete_scenario_complete.sql")
        sql_params = (request.scenarioId,)
        result = await conn.fetchrow(sql_query, request.scenarioId)

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
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
