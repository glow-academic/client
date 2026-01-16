"""Eval delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    DeleteEvalApiRequest,
    DeleteEvalApiResponse,
    DeleteEvalSqlParams,
    DeleteEvalSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/benchmark/delete_eval_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteEvalApiResponse,
    dependencies=[
        audit_activity(
            "eval.deleted", "{{ actor.name }} deleted eval '{{ eval.name }}'"
        )
    ],
)
async def delete_eval(
    request: DeleteEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteEvalApiResponse:
    """Delete an eval."""
    tags = ["evals"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Convert API request to SQL params (add profile_id from header)
            # Use double star pattern: **request.model_dump()
            params = DeleteEvalSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute query with typed helper - automatically detects and calls function if present
            result = cast(
                DeleteEvalSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.eval_id:
                raise ValueError(f"Eval not found: {request.eval_id}")

            eval_name = result.eval_name
            actor_name = result.actor_name

            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    eval={"name": eval_name, "id": str(request.eval_id)},
                )

        # Convert SQL result to API response
        api_response = DeleteEvalApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
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
            operation="delete_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
