"""Providers create endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    CreateProviderApiRequest,
    CreateProviderApiResponse,
    CreateProviderSqlParams,
    CreateProviderSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/providers/create_provider_complete.sql"


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateProviderApiResponse,
    dependencies=[
        audit_activity(
            "provider.created",
            "{{ actor.name }} created provider '{{ provider.name }}'",
        )
    ],
)
async def create_provider(
    request: CreateProviderApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProviderApiResponse:
    """Create a new provider."""
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
        params = CreateProviderSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                CreateProviderSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.provider_id:
                raise ValueError("Failed to create provider")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    provider={"name": request.name, "id": str(result.provider_id)},
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Convert SQL result to API response
        api_response = CreateProviderApiResponse.model_validate(result.model_dump())

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
