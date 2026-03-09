"""Cohort delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.cohort_delete.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.cohort_delete import delete_cohort_client
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.cohort.types import (
    DeleteCohortApiRequest,
    DeleteCohortApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeleteCohortApiResponse)
async def delete_cohort(
    request: DeleteCohortApiRequest,
    http_request: Request,
    response: Response,
) -> DeleteCohortApiResponse:
    """Bulk delete cohorts — composable infra architecture."""
    tags = ["cohorts"]

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
        result = await delete_cohort_client(
            pool,
            redis,
            profile_id=profile_id,
            cohort_ids=request.cohort_ids,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_cohort",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
