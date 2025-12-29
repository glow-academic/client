"""Delete prompt endpoint."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DeletePromptApiRequest,
    DeletePromptApiResponse,
    DeletePromptSqlParams,
    DeletePromptSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/prompts/delete_prompt_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeletePromptApiResponse,
    dependencies=[
        audit_activity(
            "prompt.deleted", "{{ actor.name }} deleted prompt '{{ prompt.name }}'"
        )
    ],
)
async def delete_prompt(
    request: DeletePromptApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePromptApiResponse:
    """Delete a prompt."""
    tags = ["prompts"]  # From router tags

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

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern for parameter construction
        params = DeletePromptSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            DeletePromptSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.prompt_name and result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                prompt={"name": result.prompt_name, "id": request.prompt_id},
            )

        # Build response - SQL function always returns a row
        api_response = DeletePromptApiResponse.model_validate(result.model_dump())

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
            operation="delete_prompt",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
