"""POST /auth/callback — lightweight redirect resolution endpoint.

Returns only the redirect_path for the authenticated profile.
Uses a dedicated lightweight SQL query (role + first available route only).
Used by the client /callback page after login to determine where to route.
"""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.routes.auth.route_permissions import compute_redirect_path
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.sql.types import (
    GetProfileContextApiRequest,
    ResolveCallbackRedirectSqlParams,
    ResolveCallbackRedirectSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_CALLBACK_PATH = "app/sql/queries/auth/resolve_callback_redirect_complete.sql"

router = APIRouter()


class GetAuthCallbackApiResponse(BaseModel):
    redirect_path: str


async def resolve_redirect_path(
    conn: asyncpg.Connection,
    profile_id: UUID | None,
) -> str:
    """Resolve redirect path for a profile using lightweight query.

    Can be called from /auth/callback or /auth/profile.
    """
    if not profile_id:
        return "/home"

    params = ResolveCallbackRedirectSqlParams(p_profile_id=profile_id)
    result = cast(
        ResolveCallbackRedirectSqlRow | None,
        await execute_sql_typed(conn, SQL_CALLBACK_PATH, params=params),
    )

    if not result:
        return "/home"

    return compute_redirect_path(result.role, result.redirect_path)


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
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        redirect_path = await resolve_redirect_path(conn, profile_id)

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
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
