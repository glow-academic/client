"""auth_item_keys endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.sql.types import (
    AuthItemKeysApiRequest,
    AuthItemKeysApiResponse,
    AuthItemKeysSqlParams,
    AuthItemKeysSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/auth_item_keys_complete.sql"

router = APIRouter()


@router.post("/auth_item_keys", response_model=AuthItemKeysApiResponse)
async def create_auth_item_keys(
    request: AuthItemKeysApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AuthItemKeysApiResponse:
    """Create auth_item_keys resource from auth + item + key tuple."""
    tags = ["resources", "auth_item_keys"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            mcp = getattr(http_request.state, "mcp", False) or False
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = AuthItemKeysSqlParams(**request_dict)
            sql_params = params.to_tuple()

            result = cast(
                AuthItemKeysSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.auth_item_keys_id:
                raise ValueError("Failed to create auth_item_keys")

        api_response = AuthItemKeysApiResponse.model_validate(result.model_dump())

        await invalidate_tags(tags, redis=get_redis_client())
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_auth_item_keys",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
