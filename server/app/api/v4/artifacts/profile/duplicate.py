"""Profile duplicate endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DuplicateProfileApiRequest,
    DuplicateProfileApiResponse,
    DuplicateProfileSqlParams,
    DuplicateProfileSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/profile/duplicate_profile_complete.sql"

router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateProfileApiResponse,
    dependencies=[
        audit_activity(
            "profile.duplicated",
            "{{ actor.name }} duplicated profile '{{ profile.name }}'",
        )
    ],
)
async def duplicate_profile(
    request: DuplicateProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateProfileApiResponse:
    """Duplicate a profile."""
    tags = ["profile"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        params = DuplicateProfileSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        result = cast(
            DuplicateProfileSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.new_profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")

        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                profile={
                    "name": result.original_name,
                    "id": str(result.new_profile_id),
                },
            )

        api_response = DuplicateProfileApiResponse.model_validate(result.model_dump())

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
