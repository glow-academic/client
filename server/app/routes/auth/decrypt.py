"""Keys decrypt endpoint — thin route, delegates to infra."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.auth.decrypt import resolve_decrypt
from app.infra.globals import get_db, get_redis_client
from app.routes.shared_types import (
    GetKeyForDecryptApiRequest,
    GetKeyForDecryptApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/decrypt", response_model=GetKeyForDecryptApiResponse)
async def decrypt_key(
    request: GetKeyForDecryptApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetKeyForDecryptApiResponse:
    """Decrypt a key's encrypted value."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        redis = get_redis_client()

        result = await resolve_decrypt(
            conn,
            redis,
            profile_id=profile_id,
            key_id=request.key_id,
            bypass_cache=bypass_cache,
        )

        return GetKeyForDecryptApiResponse(
            key=result.key,
            name=result.name,
            actor_name=result.actor_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="decrypt_key",
            request=http_request,
        )
