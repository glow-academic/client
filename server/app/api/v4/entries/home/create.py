"""Home entry CREATE endpoint."""

from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreateHomeEntriesApiRequest,
    CreateHomeEntriesApiResponse,
    CreateHomeEntriesSqlParams,
    CreateHomeEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/home/create_home_entries_complete.sql"

router = APIRouter()


async def create_home_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateHomeEntriesApiResponse:
    """Internal function to create home entry."""
    tags = ["entries", "home"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateHomeEntriesSqlParams(**request_dict)

        result = cast(
            CreateHomeEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create home entry")

    await invalidate_tags(tags)

    return CreateHomeEntriesApiResponse.model_validate(result.model_dump())


@router.post(
    "/home/create",
    response_model=CreateHomeEntriesApiResponse,
    dependencies=[
        audit_activity(
            "home.created",
            "{{ actor.name }} created home entry",
        )
    ],
)
async def create_home_entry(
    request: CreateHomeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateHomeEntriesApiResponse:
    """Create home entry."""
    tags = ["entries", "home"]
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

        api_response = await create_home_entry_internal(conn, request_dict, mcp)

        audit_set(
            http_request,
            actor={"id": profile_id},
            home={"id": str(api_response.id)},
        )

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
            operation="create_home_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
