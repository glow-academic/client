"""Profile save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_profile_id = NULL) and update (input_profile_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    SaveProfileApiRequest,
    SaveProfileApiResponse,
    SaveProfileSqlParams,
    SaveProfileSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/profile/save_profile_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveProfileApiResponse,
    dependencies=[
        audit_activity(
            "profile.saved",
            "{{ actor.name }} {% if profile %}updated{% else %}created{% endif %} profile{% if profile %} '{{ profile.name }}'{% endif %}",
        )
    ],
)
async def save_profile(
    request: SaveProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveProfileApiResponse:
    """Save profile - draft-first create/update using draft resources."""
    tags = ["profile"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency) - this is the actor
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        if not request.draft_id:
            raise HTTPException(status_code=400, detail="Draft ID is required")

        async with transaction(conn):
            # Convert API request to SQL params (add actor_profile_id from header)
            # Map input_profile_id from API request
            params = SaveProfileSqlParams(
                **request.model_dump(),
            )
            # deduplicate parameters
            params_dict = params.model_dump()
            params_dict["actor_profile_id"] = profile_id
            params = SaveProfileSqlParams(**params_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveProfileSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.profile_id:
                if request.input_profile_id:
                    raise ValueError(f"Profile not found: {request.input_profile_id}")
                else:
                    raise ValueError("Failed to create profile")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                audit_ctx["profile"] = {"id": str(result.profile_id)}
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveProfileApiResponse.model_validate(
            {
                "profile_id": str(result.profile_id),
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
            operation="save_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
