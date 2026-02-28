"""AttemptStrength entry CREATE endpoint."""

from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.entries.attempt_strength.types import (
    CreateAttemptStrengthEntryRequest,
    CreateAttemptStrengthEntryResponse,
    CreateAttemptStrengthEntrySqlParams,
    CreateAttemptStrengthEntrySqlRow,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_strength/create_attempt_strength_entries_complete.sql"

router = APIRouter()


async def create_attempt_strength_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateAttemptStrengthEntryResponse:
    """Internal function to create attempt_strength entry."""
    tags = ["entries", "attempt_strength"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateAttemptStrengthEntrySqlParams(**request_dict)

        result = cast(
            CreateAttemptStrengthEntrySqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.entry_id:
            raise ValueError("Failed to create attempt_strength entry")

    await invalidate_tags(tags)

    return CreateAttemptStrengthEntryResponse(
        id=result.entry_id,
        call_id=result.entry_call_id,
        message_id=result.entry_message_id,
    )


@router.post(
    "/attempt-strength/create",
    response_model=CreateAttemptStrengthEntryResponse,
    dependencies=[
        audit_activity(
            "attempt_strength.created",
            "{{ actor.name }} created attempt_strength entry",
        )
    ],
)
async def create_attempt_strength_entry(
    request: CreateAttemptStrengthEntryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAttemptStrengthEntryResponse:
    """Create attempt_strength entry."""
    tags = ["entries", "attempt_strength"]
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

        api_response = await create_attempt_strength_entry_internal(
            conn, request_dict, mcp
        )

        audit_set(
            http_request,
            actor={"id": profile_id},
            attempt_strength={"id": str(api_response.id)},
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
            operation="create_attempt_strength_entry",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
