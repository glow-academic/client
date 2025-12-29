"""Field new endpoint for create page."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetFieldNewApiRequest,
    GetFieldNewApiResponse,
    GetFieldNewSqlParams,
    GetFieldNewSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/fields/get_field_new_complete.sql"


router = APIRouter()


@router.post(
    "/new",
    response_model=GetFieldNewApiResponse,
    dependencies=[
        audit_activity("field.new", "{{ actor.name }} opened new field form")
    ],
)
async def get_field_new(
    request: GetFieldNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFieldNewApiResponse:
    """Get default field detail for creation mode."""
    tags = ["fields"]

    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetFieldNewApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern: **request.model_dump()
        params = GetFieldNewSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetFieldNewSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to fetch field detail data"
            )

        # Set audit context
        actor_name = result.actor_name
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Convert SQL result to API response
        # Return arrays directly from SQL result (no mapping construction)
        api_response = GetFieldNewApiResponse.model_validate(result.model_dump())

        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_field_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
