"""Messages Completions entry CREATE endpoint."""

from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreateMessagesCompletionsEntriesApiRequest,
    CreateMessagesCompletionsEntriesApiResponse,
    CreateMessagesCompletionsEntriesSqlParams,
    CreateMessagesCompletionsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/messages_completions/create_messages_completions_entries_complete.sql"

router = APIRouter()


async def create_messages_completions_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateMessagesCompletionsEntriesApiResponse:
    """Internal function to create messages_completions entry."""
    tags = ["entries", "messages_completions"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateMessagesCompletionsEntriesSqlParams(**request_dict)

        result = cast(
            CreateMessagesCompletionsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create messages_completions entry")

    await invalidate_tags(tags)

    return CreateMessagesCompletionsEntriesApiResponse.model_validate(
        result.model_dump()
    )


@router.post(
    "/messages_completions/create",
    response_model=CreateMessagesCompletionsEntriesApiResponse,
    dependencies=[
        audit_activity(
            "messages_completions.created",
            "{{ actor.name }} created messages_completions entry",
        )
    ],
)
async def create_messages_completions_entry(
    request: CreateMessagesCompletionsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateMessagesCompletionsEntriesApiResponse:
    """Create messages_completions entry."""
    tags = ["entries", "messages_completions"]
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

        api_response = await create_messages_completions_entry_internal(
            conn, request_dict, mcp
        )

        audit_set(
            http_request,
            actor={"id": profile_id},
            messages_completions={"id": str(api_response.id)},
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
            operation="create_messages_completions_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
