"""Eval save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (eval_id = NULL) and update (eval_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SaveEvalApiRequest,
    SaveEvalApiResponse,
    SaveEvalSqlParams,
    SaveEvalSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/evals/save_eval_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveEvalApiResponse,
    dependencies=[
        audit_activity(
            "eval.saved",
            "{{ actor.name }} {% if eval %}updated{% else %}created{% endif %} eval{% if eval %} '{{ eval.name }}'{% endif %}",
        )
    ],
)
async def save_eval(
    request: SaveEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveEvalApiResponse:
    """Save eval - handles both create (eval_id = NULL) and update (eval_id provided)."""
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

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            # Map input_eval_id from API request (already correct field name)
            params = SaveEvalSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveEvalSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.eval_id:
                if request.input_eval_id:
                    raise ValueError(f"Eval not found: {request.input_eval_id}")
                else:
                    raise ValueError("Failed to create eval")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add eval to audit context if input_eval_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use the request name if available
                if request.input_eval_id:
                    # Update mode: use request name (from request body)
                    # Note: In update mode, request should have name field
                    audit_ctx["eval"] = {
                        "name": getattr(request, "name", "Eval"),
                        "id": str(result.eval_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveEvalApiResponse.model_validate(
            {
                "eval_id": str(result.eval_id),
                "actor_name": result.actor_name,
            }
        )

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
            operation="save_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
