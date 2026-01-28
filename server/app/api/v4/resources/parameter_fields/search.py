"""Parameter Fields SEARCH endpoint - v4 API."""

from typing import Annotated
from uuid import UUID

import asyncpg  # type: ignore
from app.api.v4.resources.fields.search import search_fields_internal
from app.sql.types import (
    QGetFieldsV4Item,
    SearchFieldsApiRequest,
    SearchFieldsApiResponse,
)
from fastapi import APIRouter, Depends, Request, Response
from app.main import get_db


router = APIRouter()


async def search_parameter_fields_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    user_department_ids: list[UUID] | None = None,
    group_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    parameter_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[QGetFieldsV4Item]:
    """Internal function - delegates to search_fields_internal."""
    return await search_fields_internal(
        conn, search, limit_count, offset_count,
        user_department_ids, group_id, suggest_source,
        exclude_ids, parameter_id, bypass_cache
    )


@router.post("/parameter_fields/search", response_model=SearchFieldsApiResponse)
async def search_parameter_fields(
    request: SearchFieldsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchFieldsApiResponse:
    """Search parameter fields resources."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    items = await search_parameter_fields_internal(
        conn, request.search, request.limit_count, request.offset_count,
        request.user_department_ids, request.group_id, request.suggest_source,
        request.exclude_ids, request.parameter_id, bypass_cache
    )
    response.headers["X-Cache-Tags"] = ",".join(["resources", "parameter_fields"])
    return SearchFieldsApiResponse(items=items)
