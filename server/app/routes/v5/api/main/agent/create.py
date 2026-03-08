"""Agent create endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.agent_create.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.agent_create import create_agent_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.agent.types import (
    CreateAgentApiRequest,
    CreateAgentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/create", response_model=CreateAgentApiResponse)
async def create_agent(
    request: CreateAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAgentApiResponse:
    """Create agents using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await create_agent_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.agents,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "agents"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_agent",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
