"""Search simulatable profiles endpoint — thin route, delegates to infra."""

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.auth.simulatable import resolve_simulatable_profiles
from app.infra.globals import get_pool, get_redis_client
from app.routes.shared_types import (
    QSearchSimulatableProfilesV4Profile,
    SearchSimulatableProfilesApiRequest,
    SearchSimulatableProfilesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/simulatable", response_model=SearchSimulatableProfilesApiResponse)
async def search_simulatable_profiles(
    request: SearchSimulatableProfilesApiRequest,
    http_request: Request,
    response: Response,
) -> SearchSimulatableProfilesApiResponse:
    """Search profiles that can be emulated by the requester."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        redis = get_redis_client()

        pool = get_pool()
        result = await resolve_simulatable_profiles(
            pool,
            redis,
            profile_id=profile_id,
            limit_count=request.limit_count,
            query=request.query,
            bypass_cache=bypass_cache,
        )

        return SearchSimulatableProfilesApiResponse(
            actor_name=result.actor_name,
            profiles=[
                QSearchSimulatableProfilesV4Profile(
                    profile_id=p.profile_id,
                    name=p.name,
                    emails=p.emails,
                    primary_email=p.primary_email,
                    role=p.role,
                    active=p.active,
                    req_per_day=p.req_per_day,
                    primary_department_id=p.primary_department_id,
                )
                for p in result.profiles
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_simulatable_profiles",
            request=http_request,
        )
