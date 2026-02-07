"""Rubric duplicate endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.rubric.permissions import compute_can_duplicate
from app.api.v4.artifacts.rubric.types import (
    DuplicateRubricApiRequest,
    DuplicateRubricApiResponse,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CheckRubricDuplicateAccessSqlParams,
    CheckRubricDuplicateAccessSqlRow,
    DuplicateRubricSqlParams,
    DuplicateRubricSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/rubrics/check_rubric_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/sql/v4/queries/rubric/duplicate_rubric_complete.sql"


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateRubricApiResponse,
    dependencies=[
        audit_activity(
            "rubric.duplicated",
            "{{ actor.name }} duplicated rubric '{{ rubric.name }}'",
        )
    ],
)
async def duplicate_rubric(
    request: DuplicateRubricApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateRubricApiResponse:
    """Duplicate a rubric with entire hierarchy."""
    tags = ["rubrics"]

    sql_query = load_sql_query(DUPLICATE_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Permission check: get user role using typed SQL
        access_params = CheckRubricDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckRubricDuplicateAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_CHECK_SQL_PATH,
                params=access_params,
            ),
        )

        if not access_result:
            raise HTTPException(
                status_code=401,
                detail="Unable to verify user permissions.",
            )

        can_duplicate = compute_can_duplicate(user_role=access_result.user_role)

        if not can_duplicate:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate this rubric.",
            )

        async with conn.transaction():
            params = DuplicateRubricSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DuplicateRubricSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.rubric_id:
                raise ValueError(f"Rubric not found: {request.rubric_id}")

            original_name = result.original_name or "Unknown"

            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    rubric={"name": original_name, "id": str(request.rubric_id)},
                )

            api_response = DuplicateRubricApiResponse.model_validate(
                {
                    "success": True,
                    "rubric_id": str(result.rubric_id),
                    "message": f"Rubric '{original_name}' duplicated successfully",
                }
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
            operation="duplicate_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
