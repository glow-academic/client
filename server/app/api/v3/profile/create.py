"""Profile create endpoint - create a new profile."""

import uuid
from typing import Annotated, Any, cast

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (CreateProfileApiRequest, CreateProfileApiResponse,
                           CreateProfileSqlParams, CreateProfileSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/profile/create_profile_complete.sql"

router = APIRouter()


@router.post(
    "/create",
    response_model=CreateProfileApiResponse,
    dependencies=[
        audit_activity(
            "profile.created",
            "{{ actor.name }} created profile '{{ profile.name }}'",
        )
    ],
)
async def create_profile(
    request: CreateProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProfileApiResponse:
    """Create a new profile."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

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

        # Generate new profile ID
        profile_id = uuid.uuid4()

        # Convert API request to SQL params using double star pattern
        # Note: cohort_ids and department_ids are already UUIDs from auto-generated types - no conversion needed
        # Note: current_profile_id comes from header, not request body - exclude it from model_dump if present
        request_dict = request.model_dump(exclude={'current_profile_id'}, exclude_none=False)
        params = CreateProfileSqlParams(
            **request_dict,
            profile_id=profile_id,
            current_profile_id=current_profile_id,
        )
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute SQL with typed helper
            result = cast(
                CreateProfileSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise HTTPException(status_code=500, detail="Failed to create profile")

            # Check if email already exists (returned from query)
            if result.email_exists:
                primary_email = request.emails[primary_index]
                raise HTTPException(
                    status_code=400, detail=f"Email '{primary_email}' already exists"
                )

            # Verify profile was created
            if not result.profile_id:
                raise HTTPException(status_code=500, detail="Failed to create profile")

            # Set audit context with data from SQL query
            profile_name = f"{request.first_name} {request.last_name}"
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": current_profile_id},
                    profile={"name": profile_name, "id": str(result.profile_id)},
                )

        # Convert SQL result to API response
        response_data = CreateProfileApiResponse.model_validate(result.model_dump())

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
            operation="create_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
