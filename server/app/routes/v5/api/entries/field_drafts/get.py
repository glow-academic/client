"""FieldDrafts entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.field_drafts.get import get_field_drafts
from app.sql.types import (
    GetFieldDraftsEntriesApiRequest,
    GetFieldDraftsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/field_drafts/get",
    response_model=GetFieldDraftsEntriesApiResponse,
)
async def get_field_drafts_entries(
    request: GetFieldDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFieldDraftsEntriesApiResponse:
    """Get field_drafts entries by IDs."""
    tags = ["entries", "field_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_field_drafts(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetFieldDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_field_drafts_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
