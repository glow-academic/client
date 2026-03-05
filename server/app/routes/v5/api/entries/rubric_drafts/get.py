"""RubricDrafts entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.rubric_drafts.get import get_rubric_drafts
from app.sql.types import (
    GetRubricDraftsEntriesApiRequest,
    GetRubricDraftsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/rubric_drafts/get",
    response_model=GetRubricDraftsEntriesApiResponse,
)
async def get_rubric_drafts_entries(
    request: GetRubricDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRubricDraftsEntriesApiResponse:
    """Get rubric_drafts entries by IDs."""
    tags = ["entries", "rubric_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_rubric_drafts(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetRubricDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_rubric_drafts_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
