"""ProviderDrafts entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.provider_drafts.get import (
    SQL_PATH,
    get_provider_drafts_entries_internal,
)
from app.sql.types import (
    GetProviderDraftsEntriesApiRequest,
    GetProviderDraftsEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/provider_drafts/get",
    response_model=GetProviderDraftsEntriesApiResponse,
)
async def get_provider_drafts_entries(
    request: GetProviderDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProviderDraftsEntriesApiResponse:
    """Get provider_drafts entries by IDs."""
    tags = ["entries", "provider_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_provider_drafts_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProviderDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_provider_drafts_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
