"""Personas GET endpoint - v4 API.

Provides get endpoint for fetching a single persona by ID.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPersonaResourceApiRequest,
    GetPersonaResourceApiResponse,
    GetPersonaResourceSqlParams,
    GetPersonaResourceSqlRow,
    QGetPersonaResourceV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/personas/get_persona_resource_complete.sql"

router = APIRouter()


# =============================================================================
# Internal Function
# =============================================================================


async def get_persona_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> QGetPersonaResourceV4Item | None:
    """Internal function for fetching a single persona.

    Args:
        conn: Database connection
        id: Persona ID to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        Persona item or None if not found
    """
    cache_key_val = cache_key("personas/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return QGetPersonaResourceV4Item.model_validate(item_data)
            return None

    params = GetPersonaResourceSqlParams(id=id)
    result = cast(
        GetPersonaResourceSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    item = result.item if result else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["personas"],
    )

    return item


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/personas/get",
    response_model=GetPersonaResourceApiResponse,
)
async def get_persona(
    request: GetPersonaResourceApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPersonaResourceApiResponse:
    """Get persona by ID."""
    tags = ["resources", "personas"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_persona_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetPersonaResourceApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_persona",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
