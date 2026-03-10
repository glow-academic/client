"""Test GET endpoint — thin HTTP adapter over the canonical shared operation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool
from app.infra.test.get import get_test_impl_cached
from app.routes.v5.api.main.test.types import (
    GetTestArtifactRequest,
    GetTestArtifactResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=GetTestArtifactResponse)
async def get_test_artifact(
    request: GetTestArtifactRequest,
    http_request: Request,
    response: Response,
) -> GetTestArtifactResponse:
    """Get benchmark test artifact details with tests/invocations in parallel."""
    try:
        response_data, cache_hit = await get_test_impl_cached(
            pool=get_pool(),
            test_id=request.test_id,
            bypass_cache=http_request.headers.get("X-Bypass-Cache") == "1",
            cache_key_path=http_request.url.path,
        )

        response.headers["X-Cache-Tags"] = "artifacts,test"
        response.headers["X-Cache-Hit"] = "1" if cache_hit else "0"
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_test_get",
            request=http_request,
        )
