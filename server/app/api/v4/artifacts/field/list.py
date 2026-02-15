"""Fields list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids and total_parameter_links
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.field.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.field.types import (
    ListFieldApiConditionalParameter,
    ListFieldApiDepartment,
    ListFieldApiField,
    ListFieldApiPersona,
    ListFieldApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetFieldsListApiRequest,
    GetFieldsListSqlParams,
    GetFieldsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/fields/get_fields_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListFieldApiResponse,
    dependencies=[
        audit_activity("fields.list", "{{ actor.name }} visited the Fields page")
    ],
)
async def get_field_list(
    request: GetFieldsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListFieldApiResponse:
    """Get fields list with permissions and relationships."""
    tags = ["fields"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListFieldApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for audit logging and permissions
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=bypass_cache,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = None

        params = GetFieldsListSqlParams(profile_id=profile_id)
        sql_params = params.to_tuple()

        result = cast(
            GetFieldsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # user_role already fetched from context above

        # Compute permissions for each field in Python
        fields_with_permissions: list[ListFieldApiField] = []
        for field in result.fields or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                field_department_ids=field.department_ids,
                active_parameter_count=field.active_parameter_count or 0,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                field_department_ids=field.department_ids,
                active_parameter_count=field.active_parameter_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            fields_with_permissions.append(
                ListFieldApiField(
                    field_id=field.field_id,
                    name=field.name,
                    description=field.description,
                    department_ids=field.department_ids,
                    conditional_parameter_ids=field.conditional_parameter_ids,
                    persona_ids=field.persona_ids,
                    is_inactive=field.is_inactive,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=field.updated_at,
                )
            )

        # --- Python hydration: filter option names from cached *_internal() ---
        # Extract option IDs and counts from SQL result
        parameter_option_ids = getattr(result, "parameter_option_ids", None) or []
        persona_option_ids = getattr(result, "persona_option_ids", None) or []
        department_option_ids = getattr(result, "department_option_ids", None) or []

        # Build ID -> count maps
        parameter_count_map: dict[UUID, int] = {}
        parameter_ids_to_fetch: list[UUID] = []
        for opt in parameter_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                parameter_count_map[uid] = int(opt_count or 0)
                parameter_ids_to_fetch.append(uid)

        persona_count_map: dict[UUID, int] = {}
        persona_ids_to_fetch: list[UUID] = []
        for opt in persona_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                persona_count_map[uid] = int(opt_count or 0)
                persona_ids_to_fetch.append(uid)

        department_count_map: dict[UUID, int] = {}
        department_ids_to_fetch: list[UUID] = []
        for opt in department_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                department_count_map[uid] = int(opt_count or 0)
                department_ids_to_fetch.append(uid)

        # Parallel fetch names from cached *_internal() functions
        parameters_data = []
        personas_data = []
        departments_data = []

        pool = get_pool()
        has_ids = any(
            [parameter_ids_to_fetch, persona_ids_to_fetch, department_ids_to_fetch]
        )

        if pool and has_ids:

            async def fetch_parameters() -> list:
                if not parameter_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_parameters_internal(
                        c, parameter_ids_to_fetch, bypass_cache
                    )

            async def fetch_personas() -> list:
                if not persona_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_personas_internal(
                        c, persona_ids_to_fetch, bypass_cache
                    )

            async def fetch_departments() -> list:
                if not department_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, department_ids_to_fetch, bypass_cache
                    )

            parameters_data, personas_data, departments_data = await asyncio.gather(
                fetch_parameters(), fetch_personas(), fetch_departments()
            )

        # Merge names with counts, apply search filtering in Python
        conditional_parameters: list[ListFieldApiConditionalParameter] = [
            ListFieldApiConditionalParameter(
                parameter_id=p.parameter_id,
                name=p.name,
                description=p.description or "",
                count=parameter_count_map.get(p.parameter_id, 0)
                if p.parameter_id
                else 0,
            )
            for p in parameters_data
            if p.parameter_id
        ]

        personas: list[ListFieldApiPersona] = [
            ListFieldApiPersona(
                persona_id=p.persona_id,
                name=p.name,
                description=p.description or "",
                count=persona_count_map.get(p.persona_id, 0) if p.persona_id else 0,
            )
            for p in personas_data
            if p.persona_id
        ]

        departments: list[ListFieldApiDepartment] = [
            ListFieldApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description or "",
                count=department_count_map.get(d.department_id, 0)
                if d.department_id
                else 0,
            )
            for d in departments_data
            if d.department_id
        ]

        # Build API response with computed permissions
        api_response = ListFieldApiResponse(
            actor_name=actor_name,
            fields=fields_with_permissions,
            conditional_parameters=conditional_parameters,
            personas=personas,
            departments=departments,
            total_count=result.total_count,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_field_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
