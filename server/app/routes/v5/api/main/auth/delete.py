"""Auth delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.auth_delete.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.auth_delete import delete_auth_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.auth.types import (
    DeleteAuthApiRequest,
    DeleteAuthApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeleteAuthApiResponse)
async def delete_auth(
    request: DeleteAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAuthApiResponse:
    """Bulk delete auths — composable infra architecture."""
    tags = ["auth"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await delete_auth_client(
            conn,
            redis,
            profile_id=profile_id,
            auth_ids=request.auth_ids,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_auth",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
