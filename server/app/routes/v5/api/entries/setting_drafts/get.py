"""SettingDrafts entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.setting_drafts.get import get_setting_drafts
from app.sql.types import (
    GetSettingDraftsEntriesApiRequest,
    GetSettingDraftsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/setting_drafts/get",
    response_model=GetSettingDraftsEntriesApiResponse,
)
async def get_setting_drafts_entries(
    request: GetSettingDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSettingDraftsEntriesApiResponse:
    """Get setting_drafts entries by IDs."""
    tags = ["entries", "setting_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_setting_drafts(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetSettingDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_setting_drafts_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
