"""Tool save endpoint - v4 API following DHH principles (skeleton).
Unified endpoint that handles both create (tool_id = NULL) and update (tool_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SaveToolApiRequest,
    SaveToolApiResponse,
    SaveToolSqlParams,
    SaveToolSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/tools/save_tool_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveToolApiResponse,
    dependencies=[
        audit_activity(
            "tool.saved",
            "{{ actor.name }} {% if tool %}updated{% else %}created{% endif %} tool{% if tool %} '{{ tool.name }}'{% endif %}",
        )
    ],
)
async def save_tool(
    request: SaveToolApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveToolApiResponse:
    """Save tool - handles both create (tool_id = NULL) and update (tool_id provided) (skeleton)."""
    tags = ["tools"]  # From router tags

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
            params = SaveToolSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveToolSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.tool_id:
                if request.input_tool_id:
                    raise ValueError(f"Tool not found: {request.input_tool_id}")
                else:
                    raise ValueError("Failed to create tool")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add tool to audit context if input_tool_id was provided (update mode)
                if request.input_tool_id:
                    audit_ctx["tool"] = {
                        "name": request.name or "Tool",
                        "id": str(result.tool_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveToolApiResponse.model_validate(
            {
                "tool_id": str(result.tool_id),
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
            operation="save_tool",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
