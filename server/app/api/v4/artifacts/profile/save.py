"""Profile save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_profile_id = NULL) and update (input_profile_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (SaveProfileApiRequest, SaveProfileApiResponse,
                           SaveProfileSqlParams, SaveProfileSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/profile/save_profile_complete.sql"


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
    """Save profile - handles both create (input_profile_id = NULL) and update (input_profile_id provided)."""
    tags = ["profile"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency) - this is the actor
        actor_profile_id = http_request.state.profile_id
        if not actor_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Server-side validation: enforce email requirements
        # Only validate for create mode (input_profile_id = NULL)
        if request.input_profile_id is None:
            if not request.emails or len(request.emails) == 0:
                raise ValueError("At least one email is required")

            # Determine primary email index (default to 0)
            primary_index = (
                request.primary_email_index
                if request.primary_email_index is not None
                else 0
            )
            if primary_index < 0 or primary_index >= len(request.emails):
                raise ValueError("Invalid primary_email_index")

        # Validate emails array if provided for update mode
        if request.input_profile_id is not None and request.emails is not None:
            if len(request.emails) == 0:
                raise ValueError("At least one email is required")

            primary_index = (
                request.primary_email_index
                if request.primary_email_index is not None
                else 0
            )
            if primary_index < 0 or primary_index >= len(request.emails):
                raise ValueError("Invalid primary_email_index")

        async with transaction(conn):
            # Convert API request to SQL params (add actor_profile_id from header)
            # Map input_profile_id from API request
            params = SaveProfileSqlParams(
                **request.model_dump(),
                actor_profile_id=actor_profile_id,
            )
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
                audit_ctx = {"actor": {"name": result.actor_name, "id": actor_profile_id}}
                # Only add profile to audit context if input_profile_id was provided (update mode)
                # For create mode, we'll use the request name if available
                if request.input_profile_id:
                    # Update mode: use request name (from request body)
                    audit_ctx["profile"] = {
                        "name": f"{request.first_name or ''} {request.last_name or ''}".strip() or "Profile",
                        "id": str(result.profile_id),
                    }
                else:
                    # Create mode: use request name
                    audit_ctx["profile"] = {
                        "name": f"{request.first_name or ''} {request.last_name or ''}".strip() or "Profile",
                        "id": str(result.profile_id),
                    }
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
