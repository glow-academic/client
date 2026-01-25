"""Persona get endpoint - Two-pass architecture.

This implements the refactored two-pass approach:
1. Pass 1: Access check + resource ID fetching (always fresh, no cache)
2. Pass 2: Parallel resource fetching (per-resource caching)

Business logic (permissions, UI flags) is computed in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
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
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# SQL path for Pass 1
PASS1_SQL_PATH = "app/sql/v4/queries/personas/get_persona_access_complete.sql"


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

    Pass 1: Fetch IDs + metadata (no cache, always fresh for access/draft state)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query = load_sql_query(PASS1_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # === PASS 1: Fetch IDs + Metadata (always fresh, no cache) ===
        pass1_params = GetPersonaAccessSqlParams(
            profile_id=profile_id,
            persona_id=request.persona_id,
            draft_id=request.draft_id,
        )
        sql_params = pass1_params.to_tuple()

        access_result = cast(
            GetPersonaAccessSqlRow,
            await execute_sql_typed(conn, PASS1_SQL_PATH, params=pass1_params),
        )

        # === PYTHON BUSINESS LOGIC ===

        # Extract data from Pass 1 result
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        persona_department_ids = access_result.persona_department_ids or []
        active_scenario_count = access_result.active_scenario_count or 0

        # Get tools existence flags
        names_has_tools = access_result.names_has_tools or False
        colors_has_tools = access_result.colors_has_tools or False
        icons_has_tools = access_result.icons_has_tools or False
        instructions_has_tools = access_result.instructions_has_tools or False
        departments_has_tools = access_result.departments_has_tools or False
        fields_has_tools = access_result.fields_has_tools or False
        examples_has_tools = access_result.examples_has_tools or False

        # Compute show flags for departments, fields, examples (needed for can_edit)
        # These depend on data we'll fetch in Pass 2, so use suggestions count as proxy
        show_departments = len(access_result.department_suggestions or []) > 0 or len(
            access_result.department_ids or []
        ) > 0
        show_fields = len(access_result.field_suggestions or []) > 0 or len(
            access_result.field_ids or []
        ) > 0
        show_examples = len(access_result.example_suggestions or []) > 0 or len(
            access_result.example_ids or []
        ) > 0

        # Compute permissions
        can_edit = compute_can_edit(
            persona_id=request.persona_id,
            user_role=user_role,
            user_department_ids=user_department_ids,
            persona_department_ids=persona_department_ids,
            active_scenario_count=active_scenario_count,
            names_has_tools=names_has_tools,
            colors_has_tools=colors_has_tools,
            icons_has_tools=icons_has_tools,
            instructions_has_tools=instructions_has_tools,
            show_departments=show_departments,
            departments_has_tools=departments_has_tools,
            show_fields=show_fields,
            fields_has_tools=fields_has_tools,
            show_examples=show_examples,
            examples_has_tools=examples_has_tools,
        )

        disabled_reason = compute_disabled_reason(
            persona_id=request.persona_id,
            user_role=user_role,
            persona_department_ids=persona_department_ids,
            active_scenario_count=active_scenario_count,
            names_has_tools=names_has_tools,
            colors_has_tools=colors_has_tools,
            icons_has_tools=icons_has_tools,
            instructions_has_tools=instructions_has_tools,
            show_departments=show_departments,
            departments_has_tools=departments_has_tools,
            show_fields=show_fields,
            fields_has_tools=fields_has_tools,
            show_examples=show_examples,
            examples_has_tools=examples_has_tools,
        )

        # Validation
        if request.persona_id is not None:
            # Detail mode: check if persona exists and has access
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

        # === PASS 2: Parallel Resource Fetching (each endpoint handles own cache) ===

        # Combine selected IDs with suggestions for fetching
        name_ids = _combine_ids(
            access_result.name_id, access_result.name_suggestions
        )
        description_ids = _combine_ids(
            access_result.description_id, access_result.description_suggestions
        )
        color_ids = _combine_ids(
            access_result.color_id, access_result.color_suggestions
        )
        icon_ids = _combine_ids(
            access_result.icon_id, access_result.icon_suggestions
        )
        instructions_ids = _combine_ids(
            access_result.instructions_id, access_result.instructions_suggestions
        )
        flag_ids = [access_result.active_flag_id] if access_result.active_flag_id else []
        department_ids = _combine_multi_ids(
            access_result.department_ids, access_result.department_suggestions
        )
        field_ids = _combine_multi_ids(
            access_result.field_ids, access_result.field_suggestions
        )
        example_ids = _combine_multi_ids(
            access_result.example_ids, access_result.example_suggestions
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

        # Resources are already in correct auto-generated types
        # Find selected resources
        name_resource = next(
            (n for n in names if n.id == access_result.name_id), None
        )
        description_resource = next(
            (d for d in descriptions if d.id == access_result.description_id),
            None,
        )
        color_resource = next(
            (c for c in colors if c.id == access_result.color_id), None
        )
        icon_resource = next(
            (i for i in icons if i.id == access_result.icon_id), None
        )
        instructions_resource = next(
            (i for i in instructions_list if i.id == access_result.instructions_id),
            None,
        )
        flag_resource = next(
            (f for f in flags if f.id == access_result.active_flag_id), None
        )

        # Selected department/field/example resources
        selected_department_ids = access_result.department_ids or []
        selected_field_ids = access_result.field_ids or []
        selected_example_ids = access_result.example_ids or []

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
            name_id=access_result.name_id,
            name_resource=name_resource,
            show_name=show_name,
            name_agent_id=access_result.name_agent_id,
            name_required=compute_name_required(),
            name_suggestions=access_result.name_suggestions,
            names=names,
            # Description
            description_id=access_result.description_id,
            description_resource=description_resource,
            show_description=show_description_flag,
            description_agent_id=access_result.description_agent_id,
            description_required=compute_description_required(),
            description_suggestions=access_result.description_suggestions,
            descriptions=descriptions,
            # Color
            color_id=access_result.color_id,
            color_resource=color_resource,
            show_color=show_color,
            color_agent_id=access_result.color_agent_id,
            color_required=compute_color_required(),
            color_suggestions=access_result.color_suggestions,
            colors=colors,
            # Icon
            icon_id=access_result.icon_id,
            icon_resource=icon_resource,
            show_icon=show_icon,
            icon_agent_id=access_result.icon_agent_id,
            icon_required=compute_icon_required(),
            icon_suggestions=access_result.icon_suggestions,
            icons=icons,
            # Instructions
            instructions_id=access_result.instructions_id,
            instructions_resource=instructions_resource,
            show_instructions=show_instructions_flag,
            instructions_agent_id=access_result.instructions_agent_id,
            instructions_required=compute_instructions_required(),
            instructions_suggestions=access_result.instructions_suggestions,
            instructions=instructions_list,
            # Flag
            active_flag_id=access_result.active_flag_id,
            flag_resource=flag_resource,
            show_flag=show_flag,
            flag_agent_id=access_result.flag_agent_id,
            flag_required=compute_flag_required(),
            flags=flags,
            # Departments
            department_ids=access_result.department_ids,
            department_resources=department_resources,
            show_departments=show_departments_flag,
            departments_agent_id=access_result.departments_agent_id,
            departments_required=compute_departments_required(),
            department_suggestions=access_result.department_suggestions,
            departments=departments,
            # Fields
            field_ids=access_result.field_ids,
            field_resources=field_resources,
            show_fields=show_fields_flag,
            fields_agent_id=access_result.fields_agent_id,
            fields_required=compute_fields_required(),
            field_suggestions=access_result.field_suggestions,
            fields=fields,
            # Examples
            example_ids=access_result.example_ids,
            example_resources=example_resources,
            show_examples=show_examples_flag,
            examples_agent_id=access_result.examples_agent_id,
            examples_required=compute_examples_required(),
            example_suggestions=access_result.example_suggestions,
            examples=examples,
            # Multi-resource agent IDs
            basic_agent_id=access_result.basic_agent_id,
            content_agent_id=access_result.content_agent_id,
            general_agent_id=access_result.general_agent_id,
        )

        # No global cache for Pass 2 response - individual resources are cached
        # Set headers to indicate no global cache
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
