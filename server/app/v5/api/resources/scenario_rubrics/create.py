"""scenario_rubrics endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    ScenarioRubricsApiRequest,
    ScenarioRubricsApiResponse,
    ScenarioRubricsSqlParams,
    ScenarioRubricsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/scenario_rubrics_complete.sql"

router = APIRouter()


@router.post("/scenario_rubrics", response_model=ScenarioRubricsApiResponse)
async def create_scenario_rubrics(
    request: ScenarioRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioRubricsApiResponse:
    """Create scenario_rubrics resource (always INSERT)."""
    tags = ["resources", "scenario_rubrics"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            mcp = getattr(http_request.state, "mcp", False) or False

            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = ScenarioRubricsSqlParams(**request_dict)
            sql_params = params.to_tuple()

            result = cast(
                ScenarioRubricsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.id:
                raise ValueError("Failed to create scenario_rubrics")

        api_response = ScenarioRubricsApiResponse.model_validate(result.model_dump())

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
            operation="create_scenario_rubrics",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
