"""provider_keys endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.sql.types import (
    ProviderKeysApiRequest,
    ProviderKeysApiResponse,
    ProviderKeysSqlParams,
    ProviderKeysSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/provider_keys_complete.sql"

router = APIRouter()


@router.post("/provider_keys", response_model=ProviderKeysApiResponse)
async def create_provider_keys(
    request: ProviderKeysApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProviderKeysApiResponse:
    """Create provider_keys resource from provider + key pair."""
    tags = ["resources", "provider_keys"]

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
            params = ProviderKeysSqlParams(**request_dict)
            sql_params = params.to_tuple()

            result = cast(
                ProviderKeysSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.provider_keys_id:
                raise ValueError("Failed to create provider_keys")

        api_response = ProviderKeysApiResponse.model_validate(result.model_dump())

        await invalidate_tags(tags)
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
            operation="create_provider_keys",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
