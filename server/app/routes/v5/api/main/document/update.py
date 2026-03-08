"""Document update endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.document_update.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.document_update import update_document_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.document.types import (
    UpdateDocumentApiRequest,
    UpdateDocumentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/update", response_model=UpdateDocumentApiResponse)
async def update_document(
    request: UpdateDocumentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDocumentApiResponse:
    """Update documents using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await update_document_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.documents,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "documents"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_document",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
