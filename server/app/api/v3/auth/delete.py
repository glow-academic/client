"""Auth delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeleteAuthRequest(BaseModel):
    """Request to delete auth."""

    authId: str


class DeleteAuthResponse(BaseModel):
    """Response from delete auth."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteAuthResponse)
async def delete_auth(
    request: DeleteAuthRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAuthResponse:
    """Delete an auth entry."""
    tags = ["auth"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Delete auth (cascade will handle auth_items and auth_item_keys)
            sql_query = load_sql("sql/v3/auth/delete_auth_complete.sql")
            sql_params = (request.authId,)
            result = await conn.fetchrow(sql_query, request.authId)

            if not result:
                raise ValueError(f"Auth not found: {request.authId}")

            auth_name = result.get("name")
            if not auth_name:
                raise ValueError(f"Auth not found: {request.authId}")

            result_data = DeleteAuthResponse(
                success=True,
                message=f"Auth '{auth_name}' deleted successfully",
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

