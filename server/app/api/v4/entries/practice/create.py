"""Practice entry CREATE endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreatePracticeEntriesApiRequest,
    CreatePracticeEntriesApiResponse,
    CreatePracticeEntriesSqlParams,
    CreatePracticeEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/practice/create_practice_entries_complete.sql"

router = APIRouter()


@router.post(
    "/practice/create",
    response_model=CreatePracticeEntriesApiResponse,
    dependencies=[
        audit_activity(
            "practice.created",
            "{{ actor.name }} created practice entry",
        )
    ],
)
async def create_practice_entry(
    request: CreatePracticeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreatePracticeEntriesApiResponse:
    """Create practice entry."""
    tags = ["entries", "practice"]
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
            params = CreatePracticeEntriesSqlParams(**request_dict)
            sql_params = params.to_tuple()

            result = cast(
                CreatePracticeEntriesSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.id:
                raise ValueError("Failed to create practice entry")

            audit_set(
                http_request,
                actor={"id": profile_id},
                practice={"id": str(result.id)},
            )

        api_response = CreatePracticeEntriesApiResponse.model_validate(
            result.model_dump()
        )

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
            operation="create_practice_entry",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
