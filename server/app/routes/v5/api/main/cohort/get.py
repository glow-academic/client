"""Cohort GET endpoint — thin HTTP adapter over the canonical shared operation."""

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.cohort.get import get_cohort_impl
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.cohort.types import (
    GetCohortApiRequest,
    GetCohortApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=GetCohortApiResponse)
async def get_cohort(
    request: GetCohortApiRequest,
    http_request: Request,
    response: Response,
) -> GetCohortApiResponse:
    """Get cohort information using the canonical shared cohort operation."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        session_id = http_request.state.session_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_cohort_impl(
            get_pool(),
            get_redis_client(),
            profile_id=profile_id,
            session_id=session_id,
            cohort_id=request.cohort_id,
            draft_id=request.draft_id,
            descriptions_search=request.descriptions_search,
            simulation_search=request.simulation_search,
            simulation_show_selected=request.simulation_show_selected,
            profile_search=request.profile_search,
            profile_show_selected=request.profile_show_selected,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "cohorts"
        response.headers["X-Cache-Hit"] = "0"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_cohort",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
