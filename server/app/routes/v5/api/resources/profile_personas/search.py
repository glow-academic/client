"""Profile personas SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.profile_personas.search import (
    search_profile_personas as search_profile_personas_fn,
)
from app.sql.types import (
    SearchProfilePersonasApiRequest,
    SearchProfilePersonasApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/profile_personas/search",
    response_model=SearchProfilePersonasApiResponse,
)
async def search_profile_personas(
    request: SearchProfilePersonasApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchProfilePersonasApiResponse:
    """Search available profile personas for profiles."""
    tags = ["resources", "profile_personas"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_profile_personas_fn(
            conn,
            get_redis_client(),
            profile_ids=request.profile_ids,
            persona_ids=request.persona_ids,
            bypass_cache=bypass_cache,
            cohort=request.cohort or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchProfilePersonasApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_profile_personas",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
