"""Auth duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicateAuthRequest(BaseModel):
    """Request to duplicate auth."""

    authId: str
    # profileId removed - comes from X-Profile-Id header


class DuplicateAuthResponse(BaseModel):
    """Response from duplicate auth."""

    success: bool
    authId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateAuthResponse)
async def duplicate_auth(
    request: DuplicateAuthRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateAuthResponse:
    """Duplicate an auth entry with all items and their key associations."""
    tags = ["auth"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Duplicate auth with items and key links in single SQL (DHH style)
            sql_query = load_sql("sql/v3/auth/duplicate_auth_complete.sql")
            sql_params = (request.authId,)
            new_auth = await conn.fetchrow(sql_query, request.authId)

            if not new_auth:
                raise ValueError(f"Auth not found: {request.authId}")

            new_auth_id = new_auth["auth_id"]

            # Get original auth name for message
            original_auth = await conn.fetchrow(
                "SELECT name FROM auth WHERE id = $1", request.authId
            )

            result_data = DuplicateAuthResponse(
                success=True,
                authId=new_auth_id,
                message=f"Auth '{original_auth['name']}' duplicated successfully",
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
            operation="duplicate_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
