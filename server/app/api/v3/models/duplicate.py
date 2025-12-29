"""Model duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    DuplicateModelApiRequest,
    DuplicateModelApiResponse,
    DuplicateModelSqlParams,
    DuplicateModelSqlRow,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/models/duplicate_model_complete.sql"

router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateModelApiResponse,
    dependencies=[
        audit_activity(
            "model.duplicated", "{{ actor.name }} duplicated model '{{ model.name }}'"
        )
    ],
)
async def duplicate_model(
    request: DuplicateModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateModelApiResponse:
    """Duplicate a model."""
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
            # Convert API request to SQL params (add profile_id from header)
            params = DuplicateModelSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                DuplicateModelSqlRow,
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

            if not result.model_id:
                raise HTTPException(
                    status_code=400, detail="Failed to create duplicate model"
                )

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    model={
                        "name": result.original_name or "Unknown",
                        "id": str(request.model_id),
                    },
                )

            # Convert SQL result to API response
            api_response = DuplicateModelApiResponse.model_validate(result.model_dump())

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
