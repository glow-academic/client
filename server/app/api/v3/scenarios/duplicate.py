"""Scenario duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateScenarioResponse:
    """Duplicate a scenario."""
    tags = ["scenarios"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Use single comprehensive SQL file (DHH style)
            sql_query = load_sql("sql/v3/scenarios/duplicate_scenario.sql")
            sql_params = (request.scenarioId,)
            new_scenario_row = await conn.fetchrow(sql_query, request.scenarioId)

            if not new_scenario_row:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

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
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

