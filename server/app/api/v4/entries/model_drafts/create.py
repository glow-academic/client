"""Model Drafts entry CREATE endpoint."""

from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreateModelDraftsEntriesApiRequest,
    CreateModelDraftsEntriesApiResponse,
    CreateModelDraftsEntriesSqlParams,
    CreateModelDraftsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/model_drafts/create_model_drafts_entries_complete.sql"
)

router = APIRouter()


async def create_model_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateModelDraftsEntriesApiResponse:
    """Internal function to create model_drafts entry."""
    tags = ["entries", "model_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateModelDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateModelDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create model_drafts entry")

    await invalidate_tags(tags)

    return CreateModelDraftsEntriesApiResponse.model_validate(result.model_dump())


@router.post(
    "/model_drafts/create",
    response_model=CreateModelDraftsEntriesApiResponse,
    dependencies=[
        audit_activity(
            "model_drafts.created",
            "{{ actor.name }} created model_drafts entry",
        )
    ],
)
async def create_model_drafts_entry(
    request: CreateModelDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateModelDraftsEntriesApiResponse:
    """Create model_drafts entry."""
    tags = ["entries", "model_drafts"]
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

        api_response = await create_model_drafts_entry_internal(conn, request_dict, mcp)

        audit_set(
            http_request,
            actor={"id": profile_id},
            model_drafts={"id": str(api_response.id)},
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
            operation="create_model_drafts_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
