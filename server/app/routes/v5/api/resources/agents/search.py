"""Agents SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.agents.search import (
    search_agents as search_agents_fn,
)
from app.sql.types import (
    SearchAgentsApiRequest,
    SearchAgentsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/agents/search",
    response_model=SearchAgentsApiResponse,
)
async def search_agents(
    request: SearchAgentsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchAgentsApiResponse:
    """Search agents resources."""
    tags = ["resources", "agents"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_agents_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            department_ids=request.department_ids,
            tool_ids=request.tool_ids,
            instruction_ids=request.instruction_ids,
            model_ids=request.model_ids,
            prompt_ids=request.prompt_ids,
            quality=request.quality,
            bypass_cache=bypass_cache,
            agent=request.agent or False,
            setting=request.setting or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchAgentsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_agents",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
