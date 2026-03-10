"""Document GET endpoint — thin HTTP adapter over the canonical shared operation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.document.get import get_document_impl
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.document.types import (
    GetDocumentApiRequest,
    GetDocumentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=GetDocumentApiResponse)
async def get_document(
    request: GetDocumentApiRequest,
    http_request: Request,
    response: Response,
) -> GetDocumentApiResponse:
    """Get document information using the canonical shared document operation."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        session_id = http_request.state.session_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_document_impl(
            get_pool(),
            get_redis_client(),
            profile_id=profile_id,
            session_id=session_id,
            document_id=request.document_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "documents"
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
            operation="get_document",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
