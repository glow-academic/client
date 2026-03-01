"""Persona save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (persona_id = NULL) and update (persona_id provided).
Supports bulk operations and dual-mode fields (ID or value).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.permissions import (
    PERSONA_RESOURCES,
    compute_can_create,
    compute_can_edit,
)
from app.api.v4.artifacts.persona.types import (
    SavePersonaApiRequest,
    SavePersonaApiResponse,
    SavePersonaFieldError,
    SavePersonaItem,
    SavePersonaResult,
    SavePersonaSqlParams,
    SavePersonaSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.permissions import resolve_agents_for_artifact
from app.api.v4.resources.colors.search import search_colors_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.create import create_descriptions_internal
from app.api.v4.resources.examples.create import create_examples_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.icons.search import search_icons_internal
from app.api.v4.resources.instructions.create import create_instructions_internal
from app.api.v4.resources.names.create import create_names_internal
from app.api.v4.resources.parameter_fields.search import (
    search_parameter_fields_internal,
)
from app.api.v4.resources.personas.create import create_personas_internal
from app.api.v4.resources.voices.search import search_voices_internal
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

    Extracts flat resource IDs from resource_actions, creates the denormalized
    personas_resource, then executes the save SQL in a transaction.

    Returns the persona_id on success, None on failure.
    """
    try:

        def _id(key: str) -> uuid.UUID | None:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return val.get("resource_id")
            return None

        def _ids(key: str) -> list[uuid.UUID] | None:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return val.get("resource_ids")
            return None

        name_id = _id("names")
        description_id = _id("descriptions")
        color_id = _id("colors")
        icon_id = _id("icons")
        instructions_id = _id("instructions")
        active_flag_id = _id("flags")
        department_ids = _ids("departments")
        parameter_field_ids = _ids("parameter_fields")
        example_ids = _ids("examples")
        voice_ids = _ids("voices")

        async with conn.transaction():
            # Create denormalized personas_resource
            personas_resource_id = await create_personas_internal(
                conn,
                name_id=name_id,
                description_id=description_id,
                color_id=color_id,
                icon_id=icon_id,
                instructions_id=instructions_id,
                department_ids=department_ids,
                example_ids=example_ids,
                parameter_field_ids=parameter_field_ids,
            )

            params = SavePersonaSqlParams(
                profile_id=profile_id,
                input_persona_id=persona_id,
                name_id=name_id,
                description_id=description_id,
                color_id=color_id,
                icon_id=icon_id,
                instructions_id=instructions_id,
                active_flag_id=active_flag_id,
                department_ids=department_ids,
                parameter_field_ids=parameter_field_ids,
                example_ids=example_ids,
                voice_ids=voice_ids,
                personas_resource_id=personas_resource_id,
            )

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


async def _resolve_persona_values(
    conn: asyncpg.Connection,
    item: SavePersonaItem,
    is_update: bool = False,
    group_id: uuid.UUID | None = None,
    create_tool_ids: dict[str, uuid.UUID | None] | None = None,
) -> list[SavePersonaFieldError]:
    """Resolve value fields to IDs on the item (mutates in place).

    For 'create' resources (name, description, instructions, examples):
      Creates a new resource and sets the *_id field.
      When group_id and create_tool_ids are provided, tool tracking is recorded.
    For 'match' resources (color, icon, departments, voices, etc.):
      Searches by name and sets the *_id field, or returns an error.

    Returns a list of errors (empty if all resolved successfully).
    """
    errors: list[SavePersonaFieldError] = []

    # Tool tracking args (only active when both group_id and tool_id are present)
    def _tool_args(resource_key: str) -> dict:
        if group_id and create_tool_ids:
            tool_id = create_tool_ids.get(resource_key)
            if tool_id:
                return {"group_id": group_id, "tool_id": tool_id}
        return {}

    # --- Create resources (always create new) ---

    if item.name is not None and item.name_id is None:
        item.name_id = await create_names_internal(
            conn, item.name, **_tool_args("names")
        )

    if item.description is not None and item.description_id is None:
        item.description_id = await create_descriptions_internal(
            conn, item.description, **_tool_args("descriptions")
        )

    if item.instructions is not None and item.instructions_id is None:
        item.instructions_id = await create_instructions_internal(
            conn, item.instructions, **_tool_args("instructions")
        )

    if item.examples is not None and item.example_ids is None:
        example_tool_args = _tool_args("examples")
        resolved_ids = []
        for ex in item.examples:
            eid = await create_examples_internal(conn, ex, **example_tool_args)
            resolved_ids.append(eid)
        item.example_ids = resolved_ids

    # --- Match resources (find existing by name) ---

    if item.color is not None and item.color_id is None:
        results = await search_colors_internal(
            conn, search=item.color, limit_count=20, persona=True, setting=False
        )
        match = next(
            (r for r in results if r.name and r.name.lower() == item.color.lower()),
            None,
        )
        if match and match.id:
            item.color_id = match.id
        else:
            errors.append(
                SavePersonaFieldError(
                    field="color", message=f'Color "{item.color}" not found'
                )
            )

    if item.icon is not None and item.icon_id is None:
        results = await search_icons_internal(
            conn, search=item.icon, limit_count=20, persona=True
        )
        match = next(
            (r for r in results if r.name and r.name.lower() == item.icon.lower()),
            None,
        )
        if match and match.id:
            item.icon_id = match.id
        else:
            errors.append(
                SavePersonaFieldError(
                    field="icon", message=f'Icon "{item.icon}" not found'
                )
            )

    if item.active_flag is not None and item.active_flag_id is None:
        results = await search_flags_internal(
            conn, search=None, flag_type="persona_active", limit_count=100, persona=True
        )
        match = next(
            (r for r in results if r.type == "persona_active"),
            None,
        )
        if match and match.id:
            # active_flag=True → set the flag ID; active_flag=False → leave as None (inactive)
            if item.active_flag:
                item.active_flag_id = match.id
        elif item.active_flag:
            errors.append(
                SavePersonaFieldError(
                    field="active_flag", message="Active flag resource not found"
                )
            )

    if item.departments is not None and item.department_ids is None:
        # Fetch all departments and match by name
        all_depts = await search_departments_internal(
            conn, search=None, limit_count=1000, persona=True
        )
        dept_name_map = {
            d.name.lower(): d.department_id
            for d in all_depts
            if d.name and d.department_id
        }
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    SavePersonaFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    if item.voices is not None and item.voice_ids is None:
        all_voices = await search_voices_internal(
            conn, search=None, limit_count=1000, persona=True, agent=False, model=False
        )
        voice_name_map = {v.voice.lower(): v.id for v in all_voices if v.voice and v.id}
        resolved_ids = []
        for voice_name in item.voices:
            vid = voice_name_map.get(voice_name.lower())
            if vid:
                resolved_ids.append(vid)
            else:
                errors.append(
                    SavePersonaFieldError(
                        field="voices",
                        message=f'Voice "{voice_name}" not found',
                    )
                )
        if not any(e.field == "voices" for e in errors):
            item.voice_ids = resolved_ids

    if item.parameter_fields is not None and item.parameter_field_ids is None:
        all_pf = await search_parameter_fields_internal(
            conn, parameter_ids=[], persona=True
        )
        pf_name_map = {pf.name.lower(): pf.id for pf in all_pf if pf.name and pf.id}
        resolved_ids = []
        for pf_name in item.parameter_fields:
            pf_id = pf_name_map.get(pf_name.lower())
            if pf_id:
                resolved_ids.append(pf_id)
            else:
                errors.append(
                    SavePersonaFieldError(
                        field="parameter_fields",
                        message=f'Parameter field "{pf_name}" not found',
                    )
                )
        if not any(e.field == "parameter_fields" for e in errors):
            item.parameter_field_ids = resolved_ids

    # --- Validate required fields have IDs after resolution (create only) ---

    if not is_update:
        if item.name_id is None:
            errors.append(
                SavePersonaFieldError(field="name", message="Name is required")
            )
        if item.color_id is None and item.color is None:
            errors.append(
                SavePersonaFieldError(field="color", message="Color is required")
            )
        if item.icon_id is None and item.icon is None:
            errors.append(
                SavePersonaFieldError(field="icon", message="Icon is required")
            )
        if item.instructions_id is None and item.instructions is None:
            errors.append(
                SavePersonaFieldError(
                    field="instructions", message="Instructions is required"
                )
            )

    return errors


@router.post("/save", response_model=SavePersonaApiResponse)
async def save_persona(
    request: SavePersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SavePersonaApiResponse:
    """Bulk save personas — all-or-nothing single transaction.

    Each item can provide resource IDs directly or raw values that get
    resolved to IDs (create or match). If any item has resolution errors,
    the entire batch fails with per-item error details — no mutation occurs.
    """
    tags = ["personas"]

    sql_query = load_sql_query(SQL_PATH)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context once for the whole batch
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

        # Resolve create tool IDs from settings (for tool tracking on freeform creates)
        create_tool_ids: dict[str, uuid.UUID | None] | None = None
        if request.group_id and pool:
            async with pool.acquire() as settings_conn:
                settings_data = await get_auth_settings_internal(
                    settings_conn, profile_id, bypass_cache=False
                )
            _, create_tool_ids, _ = resolve_agents_for_artifact(
                settings_data.agent_tool_entries, PERSONA_RESOURCES
            )

        # Phase 1: Per-item access + permission checks (outside transaction, fail fast)
        for idx, item in enumerate(request.personas):
            access_params = CheckPersonaSaveAccessSqlParams(
                profile_id=profile_id,
                persona_id=item.input_persona_id,
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
                    detail=f"Item {idx}: Unable to verify user permissions.",
                )

            if not item.input_persona_id:
                can_save = compute_can_create(
                    user_role=user_role,
                    department_ids=None,
                )
            else:
                can_save = compute_can_edit(
                    user_role=user_role,
                    persona_department_ids=access_result.persona_department_ids,
                    active_scenario_count=access_result.active_scenario_count or 0,
                    user_department_ids=user_department_ids,
                )

            if not can_save:
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this persona.",
                )

        # Phase 2: Resolve value fields → IDs (outside transaction)
        # If any item has errors, return all errors without persisting
        has_errors = False
        error_results: list[SavePersonaResult] = []

        for idx, item in enumerate(request.personas):
            item_errors = await _resolve_persona_values(
                conn,
                item,
                is_update=item.input_persona_id is not None,
                group_id=request.group_id,
                create_tool_ids=create_tool_ids,
            )
            if item_errors:
                has_errors = True
                error_results.append(
                    SavePersonaResult(
                        success=False,
                        message=f"Item {idx}: Validation errors",
                        errors=item_errors,
                    )
                )
            else:
                error_results.append(
                    SavePersonaResult(
                        success=True,
                        message="Validated",
                    )
                )

        if has_errors:
            return SavePersonaApiResponse(results=error_results)

        # Phase 3: Single transaction — create resources + save junctions
        results: list[SavePersonaResult] = []

        async with conn.transaction():
            for idx, item in enumerate(request.personas):
                # Create denormalized personas_resource (skip for partial updates — SQL handles it)
                has_all_required = all(
                    [item.name_id, item.color_id, item.icon_id, item.instructions_id]
                )
                personas_resource_id: uuid.UUID | None = None
                if has_all_required:
                    personas_resource_id = await create_personas_internal(
                        conn,
                        name_id=item.name_id,
                        description_id=item.description_id,
                        color_id=item.color_id,
                        icon_id=item.icon_id,
                        instructions_id=item.instructions_id,
                        department_ids=item.department_ids,
                        example_ids=item.example_ids,
                        parameter_field_ids=item.parameter_field_ids,
                    )

                params = SavePersonaSqlParams.from_request(
                    item,
                    profile_id=profile_id,
                    personas_resource_id=personas_resource_id,
                )

                result = cast(
                    SavePersonaSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH,
                        params=params,
                    ),
                )

                if not result or not result.persona_id:
                    if item.input_persona_id:
                        raise ValueError(
                            f"Item {idx}: Persona not found: {item.input_persona_id}"
                        )
                    else:
                        raise ValueError(f"Item {idx}: Failed to create persona")

                is_update = item.input_persona_id is not None
                results.append(
                    SavePersonaResult(
                        success=True,
                        persona_id=result.persona_id,
                        message="Persona updated successfully"
                        if is_update
                        else "Persona created successfully",
                    )
                )

        # Audit context
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return SavePersonaApiResponse(results=results)
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
            sql_params=None,
            request=http_request,
        )
