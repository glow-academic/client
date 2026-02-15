"""Persona save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (persona_id = NULL) and update (persona_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.permissions import (
    compute_can_create,
    compute_can_save,
)
from app.api.v4.artifacts.persona.types import (
    PersonaMultiResourceAction,
    PersonaResourceAction,
    SavePersonaApiRequest,
    SavePersonaApiResponse,
    SavePersonaSqlParams,
    SavePersonaSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckPersonaSaveAccessSqlParams,
    CheckPersonaSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/personas/check_persona_save_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/personas/save_persona_complete.sql"


router = APIRouter()


async def save_persona_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None,
    resource_actions: dict[str, Any],
    persona_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a persona from resource actions dict (used by generation complete handler).

    Builds SavePersonaSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the persona_id on success, None on failure.
    """
    try:
        # Build resource action objects from dict
        def _single(key: str) -> PersonaResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return PersonaResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return PersonaResourceAction()

        def _multi(key: str) -> PersonaMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return PersonaMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return PersonaMultiResourceAction()

        params = SavePersonaSqlParams(
            profile_id=profile_id,
            input_persona_id=persona_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            colors=_single("colors"),
            icons=_single("icons"),
            instructions=_single("instructions"),
            flags=_single("flags"),
            departments=_multi("departments"),
            parameter_fields=_multi("parameter_fields"),
            examples=_multi("examples"),
            parameters=_multi("parameters"),
        )

        async with conn.transaction():
            result = cast(
                SavePersonaSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.persona_id:
                return None

        await invalidate_tags(["personas"])
        return result.persona_id

    except Exception as e:
        logger.exception(f"save_persona_internal failed: {e}")
        return None


@router.post(
    "/save",
    response_model=SavePersonaApiResponse,
    dependencies=[
        audit_activity(
            "persona.saved",
            "{{ actor.name }} {% if persona %}updated{% else %}created{% endif %} persona{% if persona %} '{{ persona.name }}'{% endif %}",
        )
    ],
)
async def save_persona(
    request: SavePersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SavePersonaApiResponse:
    """Save persona - handles both create (persona_id = NULL) and update (persona_id provided)."""
    tags = ["personas"]  # From router tags

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

        # Permission check: get user role and persona info using typed SQL
        access_params = CheckPersonaSaveAccessSqlParams(
            profile_id=profile_id,
            persona_id=request.input_persona_id,
        )
        access_result = cast(
            CheckPersonaSaveAccessSqlRow,
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
        if not request.input_persona_id:
            # Create mode: check role and department permissions
            # Note: For create, we don't have department_ids in the request yet
            # The actual department validation happens in save SQL based on draft contents
            # Here we just do role check - department validation is deferred
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=None,  # Will be validated when saving from draft
            )
        else:
            # Update mode: full permission check including user department membership
            can_save_result = compute_can_save(
                user_role=user_role,
                user_department_ids=user_department_ids,
                persona_department_ids=access_result.persona_department_ids,
                active_scenario_count=access_result.active_scenario_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this persona.",
            )

        # Create group_id in Python (moved from SQL)
        group_id = None
        if pool:
            async with pool.acquire() as group_conn:
                group_id = await group_conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
                )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id and server-resolved group_id)
            params = SavePersonaSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SavePersonaSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.persona_id:
                if request.input_persona_id:
                    raise ValueError(f"Persona not found: {request.input_persona_id}")
                else:
                    raise ValueError("Failed to create persona")

            # Set audit context with actor_name from internal fetch
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                # Only add persona to audit context if input_persona_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use the request name if available
                if request.input_persona_id:
                    # Update mode: use request name (from request body)
                    # Note: In update mode, request should have name field
                    audit_ctx["persona"] = {
                        "name": getattr(request, "name", "Persona"),
                        "id": str(result.persona_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        is_update = request.input_persona_id is not None
        api_response = SavePersonaApiResponse.model_validate(
            {
                "success": True,
                "persona_id": str(result.persona_id),
                "message": "Persona updated successfully"
                if is_update
                else "Persona created successfully",
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
            operation="save_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
