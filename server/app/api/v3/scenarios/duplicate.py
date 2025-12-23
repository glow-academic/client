"""Scenario duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicateScenarioRequest(BaseModel):
    """Request to duplicate a scenario."""

    scenarioId: str
    # profileId removed - comes from X-Profile-Id header


class DuplicateScenarioResponse(BaseModel):
    """Response from duplicate operation."""

    success: bool
    scenarioId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateScenarioResponse,
    dependencies=[
        audit_activity(
            "scenario.duplicated",
            "{{ actor.name }} duplicated scenario '{{ scenario.name }}'",
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Use single comprehensive SQL file (DHH style)
            sql_query = load_sql("app/sql/v3/scenarios/duplicate_scenario.sql")
            sql_params = (request.scenarioId, profile_id)
            new_scenario_row = await conn.fetchrow(
                sql_query, request.scenarioId, profile_id
            )

            if not new_scenario_row:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

            new_scenario_id = new_scenario_row["scenario_id"]
            scenario_name = new_scenario_row.get("scenario_name", "Unknown")
            actor_name = new_scenario_row.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    scenario={"name": scenario_name, "id": new_scenario_id},
                )

            result_data = DuplicateScenarioResponse(
                success=True,
                scenarioId=new_scenario_id,
                message=f"Scenario '{scenario_name}' duplicated successfully",
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
