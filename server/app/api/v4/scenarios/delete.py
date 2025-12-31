"""Scenario delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DeleteScenarioApiRequest,
    DeleteScenarioApiResponse,
    DeleteScenarioSqlParams,
    DeleteScenarioSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/scenarios/delete_scenario_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.deleted",
            "{{ actor.name }} deleted scenario '{{ scenario.name }}'",
        )
    ],
)
async def delete_scenario(
    request: DeleteScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteScenarioApiResponse:
    """Delete a scenario."""
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
        params = DeleteScenarioSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            DeleteScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if scenario exists using SQL result
        if not result.scenario_exists:
            raise HTTPException(
                status_code=404, detail=f"Scenario not found: {request.scenario_id}"
            )

        # Check if scenario was deleted or is in use
        if not result.deleted:
            # Scenario exists but is in use
            usage_count = result.usage_count
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete scenario that is in use by {usage_count} simulation(s)",
            )

        scenario_name = result.name
        actor_name = result.actor_name

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                scenario={"name": scenario_name, "id": str(request.scenario_id)},
            )

        # Convert SQL result to API response
        # Note: API response matches SQL response structure (scenario_exists, scenario_id, name, usage_count, deleted, actor_name)
        api_response = DeleteScenarioApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
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
