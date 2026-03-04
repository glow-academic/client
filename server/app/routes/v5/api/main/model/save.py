"""Model save endpoint - v4 API following DHH principles.

Handles both create (model_id = NULL) and update (model_id provided).
Uses two-pass architecture with Python-computed permissions.
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.model.permissions import (
    compute_can_create,
    compute_can_edit,
    has_access,
)
from app.routes.v5.api.main.model.types import (
    ModelMultiResourceAction,
    ModelResourceAction,
    SaveModelApiRequest,
    SaveModelApiResponse,
    SaveModelSqlParams,
    SaveModelSqlRow,
)
from app.sql.types import (
    CheckModelSaveAccessSqlParams,
    CheckModelSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/queries/models/check_model_save_access_complete.sql"
SQL_PATH = "app/sql/queries/models/save_model_complete.sql"
GET_NAME_SQL_PATH = "app/sql/queries/simulations/get_name_by_id_complete.sql"

router = APIRouter()


async def save_model_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    model_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a model from resource actions dict (used by generation complete handler).

    Builds SaveModelSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the model_id on success, None on failure.
    """
    try:

        def _single(key: str) -> ModelResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return ModelResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return ModelResourceAction()

        def _multi(key: str) -> ModelMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return ModelMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return ModelMultiResourceAction()

        params = SaveModelSqlParams(
            profile_id=profile_id,
            input_model_id=model_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            values=_single("values"),
            providers=_single("providers"),
            flags=_multi("flags"),
            departments=_multi("departments"),
            modalities=_multi("modalities"),
            temperature_levels=_multi("temperature_levels"),
            pricing=_multi("pricing"),
            reasoning_levels=_multi("reasoning_levels"),
            qualities=_multi("qualities"),
            voices=_multi("voices"),
        )

        async with conn.transaction():
            result = cast(
                SaveModelSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.model_id:
                return None

        await invalidate_tags(["models"], redis=get_redis_client())
        return result.model_id

    except Exception as e:
        logger.exception(f"save_model_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveModelApiResponse)
async def save_model(
    request: SaveModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveModelApiResponse:
    """Save model - create (model_id=NULL) or update.

    Uses two-pass architecture:
    1. Check access and permissions in Python
    2. Execute save if permitted
    """
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

        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Pass 1: Check access using typed access query
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

        if access_result:
            # user_role and user_department_ids already fetched from context above
            model_department_ids = (
                getattr(access_result, "model_department_ids", None) or []
            )
            active_persona_count = (
                getattr(access_result, "active_persona_count", 0) or 0
            )

            if request.input_model_id:
                # Update mode
                if not has_access(user_role, user_department_ids, model_department_ids):
                    raise HTTPException(
                        status_code=403,
                        detail="You don't have access to this model.",
                    )
                if not compute_can_edit(
                    user_role=user_role,
                    model_department_ids=model_department_ids,
                    active_agent_count=active_persona_count,
                    user_department_ids=user_department_ids,
                ):
                    raise HTTPException(
                        status_code=403,
                        detail="You don't have permission to save this model.",
                    )
            else:
                # Create mode
                request_department_ids = (
                    [str(d) for d in (request.department_ids or [])]
                    if request.department_ids
                    else []
                )
                if not compute_can_create(user_role, request_department_ids):
                    raise HTTPException(
                        status_code=403,
                        detail="You don't have permission to create models.",
                    )

        # Pass 2: Execute save
        async with conn.transaction():
            # Server-resolved group_id
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry DEFAULT VALUES RETURNING id"
            )

            # Convert flat IDs to SQL params
            params = SaveModelSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
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

        # Convert SQL result to API response
        api_response = SaveModelApiResponse.model_validate(
            {
                "model_id": str(result.model_id),
                "actor_name": actor_name,
            }
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags, redis=get_redis_client())
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
