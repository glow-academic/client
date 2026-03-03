"""Responses entry CREATE endpoint."""

from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    CreateResponsesEntriesApiRequest,
    CreateResponsesEntriesApiResponse,
    CreateResponsesEntriesSqlParams,
    CreateResponsesEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/responses/create_responses_entries_complete.sql"

router = APIRouter()


async def create_responses_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateResponsesEntriesApiResponse:
    """Internal function to create responses entry."""
    tags = ["entries", "responses"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateResponsesEntriesSqlParams(**request_dict)

        result = cast(
            CreateResponsesEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create responses entry")

    await invalidate_tags(tags)

    return CreateResponsesEntriesApiResponse.model_validate(result.model_dump())


@router.post("/responses/create", response_model=CreateResponsesEntriesApiResponse)
async def create_responses_entry(
    request: CreateResponsesEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateResponsesEntriesApiResponse:
    """Create responses entry."""
    tags = ["entries", "responses"]
    sql_query = load_sql_query(SQL_PATH)

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        mcp = getattr(http_request.state, "mcp", False) or False
        request_dict = request.model_dump()

        api_response = await create_responses_entry_internal(conn, request_dict, mcp)

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
            operation="create_responses_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
