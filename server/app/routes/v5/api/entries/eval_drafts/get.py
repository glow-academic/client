"""EvalDrafts entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.eval_drafts.get import get_eval_drafts
from app.sql.types import (
    GetEvalDraftsEntriesApiRequest,
    GetEvalDraftsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/eval_drafts/get",
    response_model=GetEvalDraftsEntriesApiResponse,
)
async def get_eval_drafts_entries(
    request: GetEvalDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetEvalDraftsEntriesApiResponse:
    """Get eval_drafts entries by IDs."""
    tags = ["entries", "eval_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_eval_drafts(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetEvalDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_eval_drafts_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
