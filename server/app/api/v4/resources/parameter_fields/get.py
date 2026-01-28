"""Parameter Fields GET endpoint - v4 API."""

from typing import Annotated
from uuid import UUID

import asyncpg  # type: ignore
from app.api.v4.resources.fields.get import get_fields_internal
from app.sql.types import (
    GetFieldsApiRequest,
    GetFieldsApiResponse,
    QGetFieldsV4Item,
)
from fastapi import APIRouter, Depends, Request, Response
from app.main import get_db


router = APIRouter()


async def get_parameter_fields_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetFieldsV4Item]:
    """Internal function - delegates to get_fields_internal."""
    return await get_fields_internal(conn, ids, bypass_cache)


@router.post("/parameter_fields/get", response_model=GetFieldsApiResponse)
async def get_parameter_fields(
    request: GetFieldsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFieldsApiResponse:
    """Get parameter fields resources by IDs."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    items = await get_parameter_fields_internal(conn, request.ids, bypass_cache)
    response.headers["X-Cache-Tags"] = ",".join(["resources", "parameter_fields"])
    return GetFieldsApiResponse(items=items)
