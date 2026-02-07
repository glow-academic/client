"""Model save endpoint - v4 API following DHH principles.

Handles both create (model_id = NULL) and update (model_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.model.permissions import (
    compute_can_create,
    compute_can_save,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CheckModelSaveAccessSqlParams,
    CheckModelSaveAccessSqlRow,
    SaveModelApiRequest,
    SaveModelApiResponse,
    SaveModelSqlParams,
    SaveModelSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/v4/queries/models/check_model_save_access_complete.sql"
SQL_PATH = "app/sql/v4/queries/models/save_model_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveModelApiResponse,
    dependencies=[
        audit_activity(
            "model.saved",
            "{{ actor.name }} {% if model %}updated{% else %}"
            "created{% endif %} model"
            "{% if model %} '{{ model.name }}'{% endif %}",
        )
    ],
)
async def save_model(
    request: SaveModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveModelApiResponse:
    """Save model - create (model_id=NULL) or update."""
    tags = ["models"]  # From router tags

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

        # Permission check: get user role and model info using typed SQL
        access_params = CheckModelSaveAccessSqlParams(
            profile_id=profile_id,
            model_id=request.input_model_id,
        )
        access_result = cast(
            CheckModelSaveAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_CHECK_SQL_PATH,
                params=access_params,
            ),
        )

        if not access_result:
            raise HTTPException(
                status_code=401,
                detail="Unable to verify user permissions.",
            )

        # Permission logic: create vs update mode
        if not request.input_model_id:
            can_save_result = compute_can_create(
                user_role=access_result.user_role,
                department_ids=None,
            )
        else:
            can_save_result = compute_can_save(
                user_role=access_result.user_role,
                user_department_ids=access_result.user_department_ids,
                model_department_ids=access_result.model_department_ids,
                active_persona_count=access_result.active_persona_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this model.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = SaveModelSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                SaveModelSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.model_id:
                if request.input_model_id:
                    raise ValueError(f"Model not found: {request.input_model_id}")
                else:
                    raise ValueError("Failed to create model")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx: dict[str, Any] = {
                    "actor": {"name": result.actor_name, "id": profile_id}
                }
                if request.input_model_id:
                    audit_ctx["model"] = {
                        "name": getattr(request, "name", "Model"),
                        "id": str(result.model_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveModelApiResponse.model_validate(
            {
                "model_id": str(result.model_id),
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
            operation="save_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
