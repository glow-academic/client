"""Keys delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (DeleteKeyApiRequest, DeleteKeyApiResponse,
                           DeleteKeySqlParams, DeleteKeySqlRow, load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/keys/delete_key_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteKeyApiResponse,
    dependencies=[
        audit_activity("key.deleted", "{{ actor.name }} deleted key '{{ key.name }}'")
    ],
)
async def delete_key(
    request: DeleteKeyApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteKeyApiResponse:
    """Delete a key with permission checks."""
    tags = ["keys"]

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
            # Convert API request to SQL params (add profile_id from header)
            # Use double star pattern: **request.model_dump()
            params = DeleteKeySqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DeleteKeySqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            # Check if key exists and has permission using SQL result
            # SQL now returns key_exists field to distinguish 404 vs 403
            if not result.key_exists:
                raise HTTPException(
                    status_code=404, detail=f"Key {request.key_id} not found"
                )
            
            if not result.key_id:
                # Key exists but user doesn't have permission to delete
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to delete this key. It may be restricted to other departments.",
                )

            # Set audit context with data from SQL query
            if result.actor_name and result.name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    key={"name": result.name, "id": str(request.key_id)},
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Convert SQL result to API response
        # Note: API response matches SQL response structure (key_exists, key_id, name, actor_name)
        api_response = DeleteKeyApiResponse.model_validate(result.model_dump())

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_key",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
