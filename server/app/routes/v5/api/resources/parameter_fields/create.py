"""parameter_fields CREATE endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.sql.types import (
    ParameterFieldsApiRequest,
    ParameterFieldsApiResponse,
    ParameterFieldsSqlParams,
    ParameterFieldsSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/resources/parameter_fields/parameter_fields_complete.sql"

router = APIRouter()


@router.post("/parameter_fields", response_model=ParameterFieldsApiResponse)
async def create_parameter_fields(
    request: ParameterFieldsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ParameterFieldsApiResponse:
    """Create parameter_fields resource (always INSERT)."""
    tags = ["resources", "parameter_fields"]

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

        async with conn.transaction():
            # Get mcp flag from header (set by router-level dependency)
            mcp = getattr(http_request.state, "mcp", False) or False

            # Convert API request to SQL params
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = ParameterFieldsSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                ParameterFieldsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.parameter_fields_id:
                raise ValueError("Failed to create parameter_fields")

        # Convert SQL result to API response
        api_response = ParameterFieldsApiResponse.model_validate(result.model_dump())

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
            operation="create_parameter_fields",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
