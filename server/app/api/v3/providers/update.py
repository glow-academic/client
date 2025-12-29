"""Providers update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    UpdateProviderApiRequest,
    UpdateProviderApiResponse,
    UpdateProviderSqlParams,
    UpdateProviderSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/providers/update_provider_complete.sql"


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateProviderApiResponse,
    dependencies=[
        audit_activity(
            "provider.updated",
            "{{ actor.name }} updated provider '{{ provider.name }}'",
        )
    ],
)
async def update_provider(
    request: UpdateProviderApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateProviderApiResponse:
    """Update an existing provider."""
    tags = ["providers"]

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
        params = UpdateProviderSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                UpdateProviderSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            # Check if provider exists using SQL result
            if not result.provider_exists:
                raise HTTPException(
                    status_code=404, detail=f"Provider {request.provider_id} not found"
                )

            if not result.provider_id:
                raise HTTPException(
                    status_code=404, detail=f"Provider {request.provider_id} not found"
                )

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    provider={"name": request.name, "id": str(request.provider_id)},
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Convert SQL result to API response
        api_response = UpdateProviderApiResponse.model_validate(result.model_dump())

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
