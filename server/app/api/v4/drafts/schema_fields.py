"""Draft schema_fields endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (CreateDraftSchemaFieldsApiRequest,
                           CreateDraftSchemaFieldsApiResponse,
                           CreateDraftSchemaFieldsSqlParams,
                           CreateDraftSchemaFieldsSqlRow, load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/drafts/schema_fields_complete.sql"


router = APIRouter()


@router.post(
    "/schema_fields",
    response_model=CreateDraftSchemaFieldsApiResponse,
    dependencies=[
        audit_activity(
            "draft.schema_fields.created",
            "{{ actor.name }} created draft schema_fields",
        )
    ],
)
async def create_draft_schema_fields(
    request: CreateDraftSchemaFieldsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateDraftSchemaFieldsApiResponse:
    """Create/update schema_fields resource and link to draft (always INSERT)."""
    tags = ["drafts", "schema_fields"]

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
            # Convert API request to SQL params (use double star pattern)
            # Frontend sends snake_case (draft_id, schema_id, name, field_type, required, position_value, template, description, default_value) - auto-generated types match SQL function signature
            params = CreateDraftSchemaFieldsSqlParams(**request.model_dump())
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                CreateDraftSchemaFieldsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.schema_field_id:
                raise ValueError("Failed to create draft schema_fields")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                draft={"id": str(request.draft_id)},
                schema_fields={"id": str(result.schema_field_id)},
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = CreateDraftSchemaFieldsApiResponse.model_validate(result.model_dump())

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
            operation="create_draft_schema_fields",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
