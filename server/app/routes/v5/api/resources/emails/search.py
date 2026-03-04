"""Emails SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.emails.search import SQL_PATH, search_emails_internal
from app.sql.types import (
    SearchEmailsApiRequest,
    SearchEmailsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/emails/search",
    response_model=SearchEmailsApiResponse,
)
async def search_emails(
    request: SearchEmailsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchEmailsApiResponse:
    """Search emails resources."""
    tags = ["resources", "emails"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_emails_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache,
            profile=request.profile or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchEmailsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_emails",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
