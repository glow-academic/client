"""Invocation bundle draft endpoint - handles autosave for benchmark bundle setup."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.invocation.types import (
    PatchSuiteDraftApiRequest,
    PatchSuiteDraftApiResponse,
    PatchSuiteDraftSqlParams,
    PatchSuiteDraftSqlRow,
)
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import load_sql_query
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/benchmark/patch_suite_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchSuiteDraftApiResponse,
)
async def patch_invocation_draft(
    request: PatchSuiteDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchSuiteDraftApiResponse:
    """Patch invocation bundle draft for bundle configuration and create/update draft."""
    tags = ["benchmark", "drafts"]

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
            params = PatchSuiteDraftSqlParams.from_request(
                request, profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchSuiteDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch invocation bundle draft")

        api_response = PatchSuiteDraftApiResponse.model_validate(result.model_dump())

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
            operation="patch_invocation_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
