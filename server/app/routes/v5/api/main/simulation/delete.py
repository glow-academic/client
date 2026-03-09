"""Simulation delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.simulation_delete.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.simulation_delete import delete_simulation_client
from app.routes.v5.api.main.simulation.types import (
    DeleteSimulationApiRequest,
    DeleteSimulationApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeleteSimulationApiResponse)
async def delete_simulation(
    request: DeleteSimulationApiRequest,
    http_request: Request,
    response: Response,
) -> DeleteSimulationApiResponse:
    """Bulk delete simulations — composable infra architecture."""
    tags = ["simulations"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()
        result = await delete_simulation_client(
            pool,
            redis,
            profile_id=profile_id,
            simulation_ids=request.simulation_ids,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_simulation",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
