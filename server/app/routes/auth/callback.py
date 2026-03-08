"""POST /auth/callback — lightweight redirect resolution endpoint.

Returns only the redirect_path for the authenticated profile.
Used by the client /callback page after login to determine where to route.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.auth.callback import resolve_callback_redirect
from app.infra.globals import get_db, get_redis_client
from app.sql.types import GetProfileContextApiRequest
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class GetAuthCallbackApiResponse(BaseModel):
    redirect_path: str


async def resolve_redirect_path(
    conn: asyncpg.Connection,
    profile_id: UUID | None,
    redis: Redis | None = None,
) -> str:
    """Resolve redirect path for a profile.

    Can be called from /auth/callback or /auth/profile.
    """
    r = redis or get_redis_client()
    return await resolve_callback_redirect(conn, r, profile_id=profile_id)


@router.post(
    "/callback",
    response_model=GetAuthCallbackApiResponse,
)
async def get_auth_callback(
    request: GetProfileContextApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthCallbackApiResponse:
    """Lightweight redirect resolution — returns only redirect_path."""
    try:
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        redis = get_redis_client()
        redirect_path = await resolve_callback_redirect(
            conn, redis, profile_id=profile_id
        )

        return GetAuthCallbackApiResponse(
            redirect_path=redirect_path,
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_callback",
            request=http_request,
        )
