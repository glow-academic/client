"""Persona save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_persona_permissions_context — access check
  3. Resource create/search tools — raw value → ID resolution
  4. Artifact create/update tools — junction writes
  5. Persona resource create tool — denormalized snapshot
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.persona_permissions_context import resolve_persona_permissions_context
from app.infra.profile_identity_context import resolve_profile_identity_context

# Artifact tools
from app.routes.v5.tools.artifacts.persona.create import (
    create_persona as create_persona_artifact,
)
from app.routes.v5.tools.artifacts.persona.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.persona.update import (
    update_persona as update_persona_artifact,
)

# Resource get tools (for denormalized snapshot hydration)
from app.routes.v5.tools.resources.colors.get import get_colors

# Resource search tools (match by name → ID)
from app.routes.v5.tools.resources.colors.search import search_colors
from app.routes.v5.tools.resources.departments.search import search_departments

# Resource create tools (raw value → ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.examples.create import create_example
from app.routes.v5.tools.resources.examples.get import get_examples
from app.routes.v5.tools.resources.fields.get import get_fields
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.icons.get import get_icons
from app.routes.v5.tools.resources.icons.search import search_icons
from app.routes.v5.tools.resources.instructions.create import create_instruction
from app.routes.v5.tools.resources.instructions.get import get_instructions
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.parameter_fields.search import (
    search_parameter_fields,
)

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.personas.create import (
    create_persona as create_persona_resource,
)
from app.routes.v5.tools.resources.voices.search import search_voices
from app.utils.cache.invalidate_tags import invalidate_tags

if TYPE_CHECKING:
    from app.routes.v5.api.main.persona.types import (
        SavePersonaApiResponse,
        SavePersonaFieldError,
        SavePersonaItem,
        SavePersonaResult,
    )


# ---------------------------------------------------------------------------
# Value resolution — raw value → ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_persona_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: SavePersonaItem,
    is_update: bool,
) -> list[SavePersonaFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description, instructions, examples):
      Creates a new resource via the create tool.
    For 'match' resources (color, icon, departments, voices, flags, parameter_fields):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.persona.types import SavePersonaFieldError

    errors: list[SavePersonaFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    if item.description is not None and item.description_id is None:
        result = await create_description(conn, item.description, redis)
        item.description_id = result.id

    if item.instructions is not None and item.instructions_id is None:
        result = await create_instruction(conn, item.instructions, redis)
        item.instructions_id = result.id

    if item.examples is not None and item.example_ids is None:
        resolved_ids = []
        for ex in item.examples:
            result = await create_example(conn, ex, redis)
            resolved_ids.append(result.id)
        item.example_ids = resolved_ids

    # --- Match resources ---

    if item.color is not None and item.color_id is None:
        results = await search_colors(
            conn,
            redis,
            search=item.color,
            limit_count=20,
            persona=True,
            setting=False,
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
        results = await search_icons(
            conn,
            redis,
            search=item.icon,
            limit_count=20,
            persona=True,
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
        results = await search_flags(
            conn,
            redis,
            search=None,
            flag_type="persona_active",
            limit_count=100,
            persona=True,
        )
        match = next((r for r in results if r.type == "persona_active"), None)
        if match and match.id:
            if item.active_flag:
                item.active_flag_id = match.id
        elif item.active_flag:
            errors.append(
                SavePersonaFieldError(
                    field="active_flag", message="Active flag resource not found"
                )
            )

    if item.departments is not None and item.department_ids is None:
        all_depts = await search_departments(
            conn,
            redis,
            search=None,
            limit_count=1000,
            persona=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
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
        all_voices = await search_voices(
            conn,
            redis,
            search=None,
            limit_count=1000,
            persona=True,
            agent=False,
            model=False,
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
        all_pf = await search_parameter_fields(conn, redis, persona=True)
        field_ids_list = [pf.field_id for pf in all_pf if pf.field_id]
        fields_list = (
            await get_fields(conn, field_ids_list, redis) if field_ids_list else []
        )
        field_name_map = {f.id: f.name for f in fields_list if f.name}
        pf_name_map = {
            field_name_map[pf.field_id].lower(): pf.id
            for pf in all_pf
            if pf.field_id and pf.id and pf.field_id in field_name_map
        }
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

    # --- Validate required fields (create only) ---

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


# ---------------------------------------------------------------------------
# Denormalized snapshot — hydrate resource IDs to values
# ---------------------------------------------------------------------------


async def _create_denormalized_snapshot(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    name_id: UUID | None,
    description_id: UUID | None,
    color_id: UUID | None,
    icon_id: UUID | None,
    instructions_id: UUID | None,
    department_ids: list[UUID] | None,
    example_ids: list[UUID] | None,
    parameter_field_ids: list[UUID] | None,
) -> UUID:
    """Create a personas_resource snapshot by hydrating IDs to values."""

    async def _empty():
        return []

    (
        names,
        descriptions,
        colors,
        icons,
        instructions,
        examples_list,
    ) = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
        get_colors(conn, [color_id], redis, bypass_cache=True)
        if color_id
        else _empty(),
        get_icons(conn, [icon_id], redis, bypass_cache=True) if icon_id else _empty(),
        get_instructions(conn, [instructions_id], redis, bypass_cache=True)
        if instructions_id
        else _empty(),
        get_examples(conn, example_ids, redis, bypass_cache=True)
        if example_ids
        else _empty(),
    )

    result = await create_persona_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
        icon=icons[0].value if icons else "",
        color=colors[0].hex_code if colors else "",
        department_ids=department_ids,
        instructions=instructions[0].template if instructions else "",
        examples=[e.example for e in examples_list],
        parameter_field_ids=parameter_field_ids,
    )
    return result.id


# ---------------------------------------------------------------------------
# save_persona_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_persona_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SavePersonaItem],
    group_id: UUID | None = None,
) -> SavePersonaApiResponse:
    """Persona save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw → ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
    """
    from app.routes.v5.api.main.persona.permissions import (
        compute_can_create,
        compute_can_edit,
    )
    from app.routes.v5.api.main.persona.types import (
        SavePersonaApiResponse,
        SavePersonaResult,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Per-item permission check ──────────────────────────────

    for idx, item in enumerate(items):
        if item.input_persona_id is not None:
            perms = await resolve_persona_permissions_context(
                conn, item.input_persona_id
            )
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Persona {item.input_persona_id} not found.",
                )
            if not compute_can_edit(
                user_role=profile.role,
                persona_department_ids=perms.department_ids,
                active_scenario_count=perms.active_scenario_count,
                user_department_ids=profile.department_ids,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this persona.",
                )
        else:
            if not compute_can_create(user_role=profile.role, department_ids=None):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to create a persona.",
                )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[SavePersonaResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_persona_values(
            conn,
            redis,
            item,
            is_update=item.input_persona_id is not None,
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
            error_results.append(SavePersonaResult(success=True, message="Validated"))

    if has_errors:
        return SavePersonaApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[SavePersonaResult] = []

    async with conn.transaction():
        for idx, item in enumerate(items):
            is_update = item.input_persona_id is not None

            # Create denormalized snapshot
            personas_resource_id = await _create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
                color_id=item.color_id,
                icon_id=item.icon_id,
                instructions_id=item.instructions_id,
                department_ids=item.department_ids,
                example_ids=item.example_ids,
                parameter_field_ids=item.parameter_field_ids,
            )

            if is_update:
                result = await update_persona_artifact(
                    conn,
                    item.input_persona_id,
                    name_id=item.name_id if item.name_id else _UNSET,
                    description_id=item.description_id
                    if item.description_id
                    else _UNSET,
                    color_id=item.color_id if item.color_id else _UNSET,
                    icon_id=item.icon_id if item.icon_id else _UNSET,
                    instruction_id=item.instructions_id
                    if item.instructions_id
                    else _UNSET,
                    department_ids=item.department_ids,
                    example_ids=item.example_ids,
                    flag_ids=[item.active_flag_id] if item.active_flag_id else None,
                    parameter_field_ids=item.parameter_field_ids,
                    persona_ids=[personas_resource_id],
                    voice_ids=item.voice_ids,
                )
                persona_id = result.id
            else:
                result = await create_persona_artifact(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    color_id=item.color_id,
                    icon_id=item.icon_id,
                    instruction_id=item.instructions_id,
                    department_ids=item.department_ids,
                    example_ids=item.example_ids,
                    flag_ids=[item.active_flag_id] if item.active_flag_id else None,
                    parameter_field_ids=item.parameter_field_ids,
                    persona_ids=[personas_resource_id],
                    voice_ids=item.voice_ids,
                )
                persona_id = result.id

            results.append(
                SavePersonaResult(
                    success=True,
                    persona_id=persona_id,
                    message="Persona updated successfully"
                    if is_update
                    else "Persona created successfully",
                )
            )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["personas"], redis=redis)

    return SavePersonaApiResponse(results=results)
