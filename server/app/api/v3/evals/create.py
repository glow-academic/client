"""Eval create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (CreateEvalApiRequest, CreateEvalApiResponse,
                           CreateEvalSqlParams, CreateEvalSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/evals/create_eval_complete.sql"


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateEvalApiResponse,
    dependencies=[
        audit_activity(
            "eval.created", "{{ actor.name }} created eval '{{ eval.name }}'"
        )
    ],
)
async def create_eval(
    request: CreateEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateEvalApiResponse:
    """Create a new eval."""
    tags = ["evals"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Convert API request to SQL params (add profile_id from header)
            # Use double star pattern: **request.model_dump()
            params = CreateEvalSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute query with typed helper - automatically detects and calls function if present
            result = cast(
                CreateEvalSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.eval_id:
                raise ValueError("Failed to create eval")

            eval_id = result.eval_id
            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    eval={"name": request.name, "id": str(eval_id)},
                )

        # Convert SQL result to API response
        api_response = CreateEvalApiResponse.model_validate(result.model_dump())

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
            operation="create_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
