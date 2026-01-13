"""Parameter save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (parameter_id = NULL) and update (parameter_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (SaveParameterApiRequest, SaveParameterApiResponse,
                           SaveParameterSqlParams, SaveParameterSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/parameters/save_parameter_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveParameterApiResponse,
    dependencies=[
        audit_activity(
            "parameter.saved",
            "{{ actor.name }} {% if parameter %}updated{% else %}created{% endif %} parameter{% if parameter %} '{{ parameter.name }}'{% endif %}",
        )
    ],
)
async def save_parameter(
    request: SaveParameterApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveParameterApiResponse:
    """Save parameter - handles both create (parameter_id = NULL) and update (parameter_id provided)."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation

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
            # Map input_parameter_id from API request (already correct field name)
            params = SaveParameterSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveParameterSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.parameter_id:
                if request.input_parameter_id:
                    raise ValueError(f"Parameter not found: {request.input_parameter_id}")
                else:
                    raise ValueError("Failed to create parameter")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add parameter to audit context if input_parameter_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use the request name if available
                if request.input_parameter_id:
                    # Update mode: use request name (from request body)
                    audit_ctx["parameter"] = {
                        "name": request.name,
                        "id": str(result.parameter_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveParameterApiResponse.model_validate(
            {
                "parameter_id": str(result.parameter_id),
                "parameter_exists": result.parameter_exists,
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
            operation="save_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
