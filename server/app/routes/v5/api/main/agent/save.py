"""Agent save endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.agent_save.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.agent_save import save_agent_client
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.agent.types import (
    SaveAgentApiRequest,
    SaveAgentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/save", response_model=SaveAgentApiResponse)
async def save_agent(
    request: SaveAgentApiRequest,
    http_request: Request,
    response: Response,
) -> SaveAgentApiResponse:
    """Save agents using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        session_id = http_request.state.session_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()

        response_data = await save_agent_client(
            pool,
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
            operation="save_agent",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
