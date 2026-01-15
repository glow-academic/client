"""Parameter duplicate endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    DuplicateParameterApiRequest,
    DuplicateParameterApiResponse,
    DuplicateParameterSqlParams,
    DuplicateParameterSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/parameters/duplicate_parameter_complete.sql"


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateParameterApiResponse,
    dependencies=[
        audit_activity(
            "parameter.duplicated",
            "{{ actor.name }} duplicated parameter '{{ parameter.name }}'",
        )
    ],
)
async def duplicate_parameter(
    request: DuplicateParameterApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateParameterApiResponse:
    """Duplicate a parameter with all items and their department associations."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation

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

        async with transaction(conn):
            # Convert API request to SQL params (add profile_id from header)
            params = DuplicateParameterSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DuplicateParameterSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result.parameter_id:
                raise ValueError(f"Parameter not found: {request.parameter_id}")

            if not result.original_name:
                raise ValueError(f"Parameter not found: {request.parameter_id}")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    parameter={
                        "name": result.original_name,
                        "id": str(request.parameter_id),
                    },
                )

        # Convert SQL result to API response
        api_response = DuplicateParameterApiResponse.model_validate(result.model_dump())

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
            operation="duplicate_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
