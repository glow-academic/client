"""Modalities GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.modalities.get import (
    SQL_PATH,
    get_modalities_internal,
)
from app.sql.types import (
    GetModalitiesApiRequest,
    GetModalitiesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/modalities/get",
    response_model=GetModalitiesApiResponse,
)
async def get_modalities(
    request: GetModalitiesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetModalitiesApiResponse:
    """Get modalities resources by IDs."""
    tags = ["resources", "modalities"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_modalities_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetModalitiesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_modalities",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
