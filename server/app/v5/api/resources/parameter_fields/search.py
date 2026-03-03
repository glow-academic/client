"""Parameter Fields SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    QGetParameterFieldsV4Item,
    SearchParameterFieldsApiRequest,
    SearchParameterFieldsApiResponse,
    SearchParameterFieldsSqlParams,
    SearchParameterFieldsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = (
    "app/v5/sql/queries/resources/parameter_fields/search_parameter_fields_complete.sql"
)

router = APIRouter()


async def search_parameter_fields_internal(
    conn: asyncpg.Connection,
    parameter_ids: list[UUID],
    field_ids: list[UUID] | None = None,
    conditional_parameter_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    document: bool = False,
    persona: bool = False,
    scenario: bool = False,
) -> list[QGetParameterFieldsV4Item]:
    """Internal function to search parameter fields by parameter IDs.

    Returns all available parameter_fields for the given parameters.
    If parameter_ids is empty, returns fields for ALL persona parameters (for upfront loading).
    Can be called directly from other routes without HTTP overhead.
    """
    tags = ["resources", "parameter_fields"]
    cache_key_val = cache_key(
        "/api/v5/resources/parameter_fields/search",
        {
            "parameter_ids": [str(id) for id in parameter_ids],
            "field_ids": sorted(str(i) for i in (field_ids or [])),
            "conditional_parameter_ids": sorted(
                str(i) for i in (conditional_parameter_ids or [])
            ),
            "document": document,
            "persona": persona,
            "scenario": scenario,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetParameterFieldsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = SearchParameterFieldsSqlParams(
        p_parameter_ids=parameter_ids or [],
        p_field_ids=field_ids or [],
        p_conditional_parameter_ids=conditional_parameter_ids or [],
        document=document,
        persona=persona,
        scenario=scenario,
    )
    result = cast(
        SearchParameterFieldsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetParameterFieldsV4Item] = (
        result.items if result and result.items else []
    )

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/parameter_fields/search",
    response_model=SearchParameterFieldsApiResponse,
)
async def search_parameter_fields(
    request: SearchParameterFieldsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchParameterFieldsApiResponse:
    """Search parameter fields resources by parameter IDs.

    Returns all available parameter_fields for the given parameters.
    """
    tags = ["resources", "parameter_fields"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_parameter_fields_internal(
            conn,
            request.parameter_ids or [],
            bypass_cache=bypass_cache,
            document=request.document or False,
            persona=request.persona or False,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchParameterFieldsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_parameter_fields",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
