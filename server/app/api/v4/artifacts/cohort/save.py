"""Cohort save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (cohort_id = NULL) and update (cohort_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.cohort.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.api.v4.artifacts.cohort.types import (
    CohortMultiResourceAction,
    CohortResourceAction,
    SaveCohortApiRequest,
    SaveCohortApiResponse,
    SaveCohortSqlParams,
    SaveCohortSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetCohortAccessSqlParams,
    GetCohortAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# Load SQL with types at module level - makes it clear what SQL file is used
ACCESS_SQL_PATH = "app/sql/v4/queries/cohorts/get_cohort_access_complete.sql"
SQL_PATH = "app/sql/v4/queries/cohorts/save_cohort_complete.sql"


router = APIRouter()


async def save_cohort_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    cohort_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a cohort from resource actions dict (used by generation complete handler).

    Builds SaveCohortSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the cohort_id on success, None on failure.
    """
    try:

        def _single(key: str) -> CohortResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return CohortResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return CohortResourceAction()

        def _multi(key: str) -> CohortMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return CohortMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return CohortMultiResourceAction()

        params = SaveCohortSqlParams(
            profile_id=profile_id,
            input_cohort_id=cohort_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_single("flags"),
            departments=_multi("departments"),
            simulations=_multi("simulations"),
            simulation_positions=_multi("simulation_positions"),
            simulation_position_values=resource_actions.get("simulation_position_values"),
        )

        async with conn.transaction():
            result = cast(
                SaveCohortSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.cohort_id:
                return None

        await invalidate_tags(["cohorts"])
        return result.cohort_id

    except Exception as e:
        logger.exception(f"save_cohort_internal failed: {e}")
        return None


@router.post(
    "/save",
    response_model=SaveCohortApiResponse,
    dependencies=[
        audit_activity(
            "cohort.saved",
            "{{ actor.name }} {% if cohort %}updated{% else %}created{% endif %} cohort{% if cohort %} '{{ cohort.name }}'{% endif %}",
        )
    ],
)
async def save_cohort(
    request: SaveCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveCohortApiResponse:
    """Save cohort - draft-first create/update using draft resources."""
    tags = ["cohorts"]  # From router tags

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

        # Fetch user context for permissions and audit logging
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

        # Permission checks
        if request.input_cohort_id:
            # Update mode: check access and save permissions
            access_params = GetCohortAccessSqlParams(
                profile_id=profile_id,
                cohort_id=request.input_cohort_id,
            )
            access_result = cast(
                GetCohortAccessSqlRow,
                await execute_sql_typed(conn, ACCESS_SQL_PATH, params=access_params),
            )
            if access_result and access_result.cohort_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Cohort {request.input_cohort_id} not found",
                )
            if not compute_can_edit(
                user_role=user_role,
                cohort_department_ids=getattr(
                    access_result, "cohort_department_ids", None
                )
                or [],
                user_department_ids=user_department_ids,
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to save this cohort.",
                )
        else:
            # Create mode: check create permissions
            request_department_ids = request.department_ids or None
            if not compute_can_create(user_role or "", request_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to create cohorts.",
                )

        # Server-resolved group_id: create if not updating an existing cohort
        group_id = None
        if not request.input_cohort_id:
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
            )

        async with conn.transaction():
            # Convert flat resource IDs to SQL params (add profile_id and group_id from server)
            params = SaveCohortSqlParams.from_request(request, profile_id=profile_id, group_id=group_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveCohortSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.cohort_id:
                if request.input_cohort_id:
                    raise ValueError(f"Cohort not found: {request.input_cohort_id}")
                raise ValueError("Failed to save cohort")

            # Set audit context with data from SQL query
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                audit_ctx["cohort"] = {"id": str(result.cohort_id)}
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveCohortApiResponse.model_validate(
            {
                "cohort_id": str(result.cohort_id),
                "actor_name": actor_name,
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
            operation="save_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
