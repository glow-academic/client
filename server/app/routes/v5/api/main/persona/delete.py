"""Persona delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.persona_delete.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.persona_delete import delete_persona_client
from app.routes.v5.api.main.persona.types import (
    DeletePersonaApiRequest,
    DeletePersonaApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeletePersonaApiResponse)
async def delete_persona(
    request: DeletePersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaApiResponse:
    """Bulk delete personas — composable infra architecture."""
    tags = ["personas"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await delete_persona_client(
            conn,
            redis,
            profile_id=profile_id,
            persona_ids=request.persona_ids,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_persona",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
