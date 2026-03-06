"""Settings SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.settings.search import (
    search_settings as search_settings_fn,
)
from app.sql.types import (
    SearchSettingsApiRequest,
    SearchSettingsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/settings/search",
    response_model=SearchSettingsApiResponse,
)
async def search_settings(
    request: SearchSettingsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSettingsApiResponse:
    """Search settings resources."""
    tags = ["resources", "settings"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_settings_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            department_ids=request.department_ids,
            agent_ids=request.agent_ids,
            provider_key_ids=request.provider_key_ids,
            auth_ids=request.auth_ids,
            bypass_cache=bypass_cache,
            department=request.department or False,
            setting=request.setting or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchSettingsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_settings",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
