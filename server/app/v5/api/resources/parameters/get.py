"""Parameters GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    GetParametersApiRequest,
    GetParametersApiResponse,
    GetParametersSqlParams,
    GetParametersSqlRow,
    QGetParametersV4Item,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/v5/sql/queries/resources/parameters/get_parameters_complete.sql"

router = APIRouter()


async def get_parameters_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
    persona_parameter: bool | None = None,
    document_parameter: bool | None = None,
    scenario_parameter: bool | None = None,
    video_parameter: bool | None = None,
) -> list[QGetParametersV4Item]:
    """Internal function to fetch parameters by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "parameters"]
    cache_key_val = cache_key(
        "/api/v5/resources/parameters/get",
        {
            "ids": [str(id) for id in ids],
            "persona_parameter": persona_parameter,
            "document_parameter": document_parameter,
            "scenario_parameter": scenario_parameter,
            "video_parameter": video_parameter,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetParametersV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetParametersSqlParams(
        ids=ids,
        p_persona_parameter=persona_parameter,
        p_document_parameter=document_parameter,
        p_scenario_parameter=scenario_parameter,
        p_video_parameter=video_parameter,
    )
    result = cast(
        GetParametersSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetParametersV4Item] = result.items if result and result.items else []

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/parameters/get",
    response_model=GetParametersApiResponse,
)
async def get_parameters(
    request: GetParametersApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetParametersApiResponse:
    """Get parameters resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "parameters"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_parameters_internal(
            conn,
            request.ids,
            bypass_cache,
            request.p_persona_parameter,
            request.p_document_parameter,
            request.p_scenario_parameter,
            request.p_video_parameter,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetParametersApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_parameters",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
