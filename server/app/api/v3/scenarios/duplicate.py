"""Scenario duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (DuplicateScenarioApiRequest,
                           DuplicateScenarioApiResponse,
                           DuplicateScenarioSqlParams, DuplicateScenarioSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/scenarios/duplicate_scenario_complete.sql"


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.duplicated",
            "{{ actor.name }} duplicated scenario '{{ scenario.name }}'",
        )
    ],
)
async def duplicate_scenario(
    request: DuplicateScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateScenarioApiResponse:
    """Duplicate a scenario."""
    tags = ["scenarios"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        params = DuplicateScenarioSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            DuplicateScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.scenario_id:
            raise ValueError(f"Scenario not found: {request.scenarioId}")

        new_scenario_id = str(result.scenario_id)
        scenario_name = result.scenario_name or "Unknown"
        actor_name = result.actor_name

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                scenario={"name": scenario_name, "id": new_scenario_id},
            )

        result_data = DuplicateScenarioApiResponse(
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
