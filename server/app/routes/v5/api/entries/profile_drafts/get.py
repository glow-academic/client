"""ProfileDrafts entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.profile_drafts.get import get_profile_drafts
from app.sql.types import (
    GetProfileDraftsEntriesApiRequest,
    GetProfileDraftsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/profile_drafts/get",
    response_model=GetProfileDraftsEntriesApiResponse,
)
async def get_profile_drafts_entries(
    request: GetProfileDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileDraftsEntriesApiResponse:
    """Get profile_drafts entries by IDs."""
    tags = ["entries", "profile_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_profile_drafts(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProfileDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_drafts_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
