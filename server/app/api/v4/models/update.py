"""Model update endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    UpdateModelApiRequest,
    UpdateModelApiResponse,
    UpdateModelSqlParams,
    UpdateModelSqlRow,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/models/update_model_complete.sql"

router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateModelApiResponse,
    dependencies=[
        audit_activity(
            "model.updated", "{{ actor.name }} updated model '{{ model.name }}'"
        )
    ],
)
async def update_model(
    request: UpdateModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateModelApiResponse:
    """Update an existing model."""
    tags = ["models"]  # From router tags

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
            # Convert API request to SQL params using double star pattern
            params = UpdateModelSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                UpdateModelSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            # Check if model exists using SQL result
            if not result.model_exists:
                raise HTTPException(
                    status_code=404, detail=f"Model {request.model_id} not found"
                )

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    model={
                        "name": result.model_name or "Unknown",
                        "id": str(request.model_id),
                    },
                )

            # Convert SQL result to API response
            api_response = UpdateModelApiResponse.model_validate(result.model_dump())

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
            operation="update_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
