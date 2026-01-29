"""Profile create or update endpoint - create or update a profile based on email."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    CreateOrUpdateProfileApiRequest,
    CreateOrUpdateProfileApiResponse,
    CreateOrUpdateProfileSqlParams,
    CreateOrUpdateProfileSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/profile/create_or_update_profile_complete.sql"

router = APIRouter()


@router.post(
    "/upsert",
    response_model=CreateOrUpdateProfileApiResponse,
    dependencies=[
        audit_activity(
            "profile.upserted",
            "{{ actor.name }} {{ created }} profile '{{ profile.name }}'",
        )
    ],
)
async def create_or_update_profile(
    request: CreateOrUpdateProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateOrUpdateProfileApiResponse:
    """Create or update a profile based on email."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Validate emails array
        if not request.emails or len(request.emails) == 0:
            raise HTTPException(
                status_code=400, detail="At least one email is required"
            )

        # Determine primary email index (default to 0)
        primary_index = (
            request.primary_email_index
            if request.primary_email_index is not None
            else 0
        )
        if primary_index < 0 or primary_index >= len(request.emails):
            raise HTTPException(status_code=400, detail="Invalid primary_email_index")

        # Get current_profile_id from header (optional for upsert)
        current_profile_id = http_request.state.profile_id

        # Convert API request to SQL params using double star pattern
        # Pydantic handles UUID conversion from strings automatically if types are correct
        # SQL handles None-to-empty conversions via COALESCE in params CTE
        # SQL generates profile_id_new if not provided (for creates)
        # Exclude current_profile_id from request if present (we override it)
        request_dict = request.model_dump(
            exclude={"current_profile_id"}, exclude_none=False
        )
        params = CreateOrUpdateProfileSqlParams(
            **request_dict,
            current_profile_id=current_profile_id,
        )
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute SQL with typed helper
            result = cast(
                CreateOrUpdateProfileSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise HTTPException(
                    status_code=500, detail="Failed to create or update profile"
                )

            profile_id = result.profile_id
            created = result.created

            # Set audit context
            profile_name = request.name
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": current_profile_id}
                    if current_profile_id
                    else {},
                    created="created" if created else "updated",
                    profile={
                        "name": profile_name,
                        "id": str(profile_id),
                    },
                )

        # Convert SQL result to API response
        response_data = CreateOrUpdateProfileApiResponse.model_validate(
            result.model_dump()
        )

        # Invalidate cache after mutation
        tags = ["profile"]  # Profile operations
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_or_update_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
