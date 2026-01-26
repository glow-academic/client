"""Persona get endpoint - Two-pass architecture.

This implements the refactored two-pass approach:
1. Query 1: Access check (user context, persona state)
2. Query 2: ID fetching (resource IDs, suggestions, agents)
3. Pass 2: Parallel resource fetching (per-resource caching)

Business logic (permissions, UI flags) is computed in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.permissions import (
    compute_can_edit,
    compute_color_required,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_examples_required,
    compute_fields_required,
    compute_flag_required,
    compute_icon_required,
    compute_instructions_required,
    compute_name_required,
    compute_show_color,
    compute_show_departments,
    compute_show_description,
    compute_show_examples,
    compute_show_fields,
    compute_show_flag,
    compute_show_icon,
    compute_show_instructions,
    compute_show_name,
    has_access,
)
from app.api.v4.artifacts.persona.types import (
    GetPersonaApiRequest,
    GetPersonaApiResponse,
)
from app.api.v4.resources.colors.get import get_colors_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.examples.get import get_examples_internal
from app.api.v4.resources.fields.get import get_fields_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.icons.get import get_icons_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.names.get import get_names_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPersonaAccessSqlParams,
    GetPersonaAccessSqlRow,
    GetPersonaIdsSqlParams,
    GetPersonaIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/personas/get_persona_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/personas/get_persona_ids_complete.sql"


router = APIRouter()


def _combine_ids(
    selected_id: UUID | None, suggestion_ids: list[UUID] | None
) -> list[UUID]:
    """Combine selected ID with suggestion IDs, deduplicating."""
    ids = []
    if selected_id:
        ids.append(selected_id)
    if suggestion_ids:
        for sid in suggestion_ids:
            if sid not in ids:
                ids.append(sid)
    return ids


def _combine_multi_ids(
    selected_ids: list[UUID] | None, suggestion_ids: list[UUID] | None
) -> list[UUID]:
    """Combine selected IDs with suggestion IDs, deduplicating."""
    ids = []
    if selected_ids:
        ids.extend(selected_ids)
    if suggestion_ids:
        for sid in suggestion_ids:
            if sid not in ids:
                ids.append(sid)
    return ids


@router.post(
    "/get",
    response_model=GetPersonaApiResponse,
    dependencies=[
        audit_activity(
            "persona.get",
            "{{ actor.name }} {% if persona %}viewed{% else %}opened new{% endif %} persona{% if persona %} '{{ persona.name }}'{% endif %}",
        )
    ],
)
async def get_persona(
    request: GetPersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPersonaApiResponse:
    """Get persona information using two-pass architecture.

    Query 1: Access check (user role, departments, persona state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query = load_sql_query(QUERY1_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # === QUERY 1: Access Check (always fresh, no cache) ===
        query1_params = GetPersonaAccessSqlParams(
            profile_id=profile_id,
            persona_id=request.persona_id,
            draft_id=request.draft_id,
        )
        sql_params = query1_params.to_tuple()

        access_result = cast(
            GetPersonaAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        persona_department_ids = access_result.persona_department_ids or []
        active_scenario_count = access_result.active_scenario_count or 0

        # Early validation: check persona exists
        if request.persona_id is not None:
            if access_result.persona_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Persona {request.persona_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, persona_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this persona. It may be restricted to other departments.",
                )

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetPersonaIdsSqlParams(
            profile_id=profile_id,
            persona_id=request.persona_id,
            draft_id=request.draft_id,
            group_id=access_result.group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetPersonaIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

        # Get tools existence flags from Query 2 (used for show_* UI flags)
        names_has_tools = ids_result.names_has_tools or False
        colors_has_tools = ids_result.colors_has_tools or False
        icons_has_tools = ids_result.icons_has_tools or False
        instructions_has_tools = ids_result.instructions_has_tools or False

        # === PYTHON BUSINESS LOGIC ===

        # Compute permissions (simplified - no tools check needed for can_edit)
        can_edit = compute_can_edit(
            user_role=user_role,
            persona_department_ids=persona_department_ids,
            active_scenario_count=active_scenario_count,
        )

        disabled_reason = compute_disabled_reason(
            user_role=user_role,
            persona_department_ids=persona_department_ids,
            active_scenario_count=active_scenario_count,
        )

        # === PASS 2: Parallel Resource Fetching (each endpoint handles own cache) ===

        # Combine selected IDs with suggestions for fetching
        name_ids = _combine_ids(
            ids_result.name_id, ids_result.name_suggestions
        )
        description_ids = _combine_ids(
            ids_result.description_id, ids_result.description_suggestions
        )
        color_ids = _combine_ids(
            ids_result.color_id, ids_result.color_suggestions
        )
        icon_ids = _combine_ids(
            ids_result.icon_id, ids_result.icon_suggestions
        )
        instructions_ids = _combine_ids(
            ids_result.instructions_id, ids_result.instructions_suggestions
        )
        flag_ids = [ids_result.active_flag_id] if ids_result.active_flag_id else []
        department_ids = _combine_multi_ids(
            ids_result.department_ids, ids_result.department_suggestions
        )
        field_ids = _combine_multi_ids(
            ids_result.field_ids, ids_result.field_suggestions
        )
        example_ids = _combine_multi_ids(
            ids_result.example_ids, ids_result.example_suggestions
        )

        # Parallel fetch all resources
        (
            names,
            descriptions,
            colors,
            icons,
            instructions_list,
            flags,
            departments,
            fields,
            examples,
        ) = await asyncio.gather(
            get_names_internal(conn, name_ids, None, bypass_cache),
            get_descriptions_internal(
                conn, description_ids, request.descriptions_search, bypass_cache
            ),
            get_colors_internal(conn, color_ids, request.color_search, bypass_cache),
            get_icons_internal(conn, icon_ids, request.icon_search, bypass_cache),
            get_instructions_internal(
                conn, instructions_ids, request.instructions_search, bypass_cache
            ),
            get_flags_internal(conn, flag_ids, None, bypass_cache),
            get_departments_internal(conn, department_ids, None, bypass_cache),
            get_fields_internal(conn, field_ids, request.field_search, bypass_cache),
            get_examples_internal(conn, example_ids, None, bypass_cache),
        )

        # Find selected resources
        name_resource = next(
            (n for n in names if n.id == ids_result.name_id), None
        )
        description_resource = next(
            (d for d in descriptions if d.id == ids_result.description_id),
            None,
        )
        color_resource = next(
            (c for c in colors if c.id == ids_result.color_id), None
        )
        icon_resource = next(
            (i for i in icons if i.id == ids_result.icon_id), None
        )
        instructions_resource = next(
            (i for i in instructions_list if i.id == ids_result.instructions_id),
            None,
        )
        flag_resource = next(
            (f for f in flags if f.id == ids_result.active_flag_id), None
        )

        # Selected department/field/example resources
        selected_department_ids = ids_result.department_ids or []
        selected_field_ids = ids_result.field_ids or []
        selected_example_ids = ids_result.example_ids or []

        department_resources = [
            d for d in departments if d.department_id in selected_department_ids
        ]
        field_resources = [
            f for f in fields if f.field_id in selected_field_ids
        ]
        example_resources = [
            e for e in examples if e.id in selected_example_ids
        ]

        # Compute final show flags based on actual data
        show_name = compute_show_name(names_has_tools)
        show_description_flag = compute_show_description()
        show_color = compute_show_color(colors_has_tools, len(colors))
        show_icon = compute_show_icon(icons_has_tools, len(icons))
        show_instructions_flag = compute_show_instructions(instructions_has_tools)
        show_flag = compute_show_flag()
        show_departments_flag = compute_show_departments(len(departments))
        show_fields_flag = compute_show_fields(len(fields))
        show_examples_flag = compute_show_examples(len(examples))

        # Set audit context
        if access_result.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": access_result.actor_name, "id": profile_id}
            }
            if request.persona_id and name_resource and name_resource.name:
                audit_ctx["persona"] = {
                    "name": name_resource.name,
                    "id": str(request.persona_id),
                }
            audit_set(http_request, **audit_ctx)

        # Validation for new mode
        if request.persona_id is None:
            # New mode: check for valid departments
            if not departments:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )

        # Detail mode: check access via name_resource
        if request.persona_id is not None and not name_resource:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this persona. It may be restricted to other departments.",
            )

        # === Construct Response ===
        response_data = GetPersonaApiResponse(
            # Required fields
            actor_name=access_result.actor_name,
            persona_exists=access_result.persona_exists,
            can_edit=can_edit,
            disabled_reason=disabled_reason,
            draft_version=access_result.draft_version,
            group_id=access_result.group_id,
            # Name
            name_id=ids_result.name_id,
            name_resource=name_resource,
            show_name=show_name,
            name_agent_id=ids_result.name_agent_id,
            name_required=compute_name_required(),
            name_suggestions=ids_result.name_suggestions,
            names=names,
            # Description
            description_id=ids_result.description_id,
            description_resource=description_resource,
            show_description=show_description_flag,
            description_agent_id=ids_result.description_agent_id,
            description_required=compute_description_required(),
            description_suggestions=ids_result.description_suggestions,
            descriptions=descriptions,
            # Color
            color_id=ids_result.color_id,
            color_resource=color_resource,
            show_color=show_color,
            color_agent_id=ids_result.color_agent_id,
            color_required=compute_color_required(),
            color_suggestions=ids_result.color_suggestions,
            colors=colors,
            # Icon
            icon_id=ids_result.icon_id,
            icon_resource=icon_resource,
            show_icon=show_icon,
            icon_agent_id=ids_result.icon_agent_id,
            icon_required=compute_icon_required(),
            icon_suggestions=ids_result.icon_suggestions,
            icons=icons,
            # Instructions
            instructions_id=ids_result.instructions_id,
            instructions_resource=instructions_resource,
            show_instructions=show_instructions_flag,
            instructions_agent_id=ids_result.instructions_agent_id,
            instructions_required=compute_instructions_required(),
            instructions_suggestions=ids_result.instructions_suggestions,
            instructions=instructions_list,
            # Flag
            active_flag_id=ids_result.active_flag_id,
            flag_resource=flag_resource,
            show_flag=show_flag,
            flag_agent_id=ids_result.flag_agent_id,
            flag_required=compute_flag_required(),
            flags=flags,
            # Departments
            department_ids=ids_result.department_ids,
            department_resources=department_resources,
            show_departments=show_departments_flag,
            departments_agent_id=ids_result.departments_agent_id,
            departments_required=compute_departments_required(),
            department_suggestions=ids_result.department_suggestions,
            departments=departments,
            # Fields
            field_ids=ids_result.field_ids,
            field_resources=field_resources,
            show_fields=show_fields_flag,
            fields_agent_id=ids_result.fields_agent_id,
            fields_required=compute_fields_required(),
            field_suggestions=ids_result.field_suggestions,
            fields=fields,
            # Examples
            example_ids=ids_result.example_ids,
            example_resources=example_resources,
            show_examples=show_examples_flag,
            examples_agent_id=ids_result.examples_agent_id,
            examples_required=compute_examples_required(),
            example_suggestions=ids_result.example_suggestions,
            examples=examples,
            # Multi-resource agent IDs
            basic_agent_id=ids_result.basic_agent_id,
            content_agent_id=ids_result.content_agent_id,
            general_agent_id=ids_result.general_agent_id,
        )

        # No global cache for this response - individual resources are cached
        response.headers["X-Cache-Tags"] = "personas"
        response.headers["X-Cache-Hit"] = "0"
        response.headers["X-Two-Pass"] = "1"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
