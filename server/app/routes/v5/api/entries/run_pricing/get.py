"""Run Pricing entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.run_pricing.get import (
    SQL_PATH,
    get_run_pricing_entries_internal,
)
from app.sql.types import (
    GetRunPricingEntriesApiRequest,
    GetRunPricingEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/run_pricing/get",
    response_model=GetRunPricingEntriesApiResponse,
)
async def get_run_pricing_entries(
    request: GetRunPricingEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRunPricingEntriesApiResponse:
    """Get run_pricing entries by IDs."""
    tags = ["entries", "run_pricing"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_run_pricing_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetRunPricingEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_run_pricing_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
