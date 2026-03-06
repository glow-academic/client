"""Persona GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_persona_context — artifact + draft → merged + hydrated resources
  3. score_tools — tool graph + artifact resources → per-resource tool picks
  4. Pure Python — permissions, show/required flags, response assembly
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from redis.asyncio import Redis

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_redis_client
from app.infra.helpers import dedupe_by_id
from app.infra.persona_context import resolve_persona_context
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.persona.permissions import (
    PERSONA_RESOURCES,
    compute_can_edit,
    compute_color_required,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_examples_required,
    compute_flag_required,
    compute_icon_required,
    compute_instructions_required,
    compute_name_required,
    compute_parameter_fields_required,
    compute_parameters_required,
    compute_show_ai_generate,
    compute_show_color,
    compute_show_departments,
    compute_show_description,
    compute_show_examples,
    compute_show_flag,
    compute_show_icon,
    compute_show_instructions,
    compute_show_name,
    compute_show_parameter_fields,
    compute_show_parameters,
    compute_show_voices,
    compute_voices_required,
    has_access,
)
from app.routes.v5.api.main.persona.types import (
    GetPersonaApiRequest,
    GetPersonaApiResponse,
    PersonaColorSection,
    PersonaDepartmentSection,
    PersonaDescriptionSection,
    PersonaExampleSection,
    PersonaFlagConfig,
    PersonaFlagSection,
    PersonaIconSection,
    PersonaInstructionSection,
    PersonaNameSection,
    PersonaParameterFieldSection,
    PersonaParameterSection,
    PersonaVoiceSection,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


# ---------------------------------------------------------------------------
# get_persona_client — composable infra architecture
# ---------------------------------------------------------------------------


async def get_persona_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    persona_id: UUID | None,
    draft_id: UUID | None = None,
    group_id: UUID,
    parameter_ids: list[UUID] | None = None,
    # Search filters (threaded from client)
    color_search: str | None = None,
    icon_search: str | None = None,
    descriptions_search: str | None = None,
    instructions_search: str | None = None,
    color_show_selected: bool | None = None,
    icon_show_selected: bool | None = None,
    bypass_cache: bool = False,
) -> GetPersonaApiResponse:
    """Persona GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_persona_context(persona_id, draft_id, ...) → hydrated resources
      3. Access check (404, 403)
      4. score_tools(tool_graph, PERSONA_RESOURCES) → per-resource tool picks
      5. Pure Python: permissions, show/required/AI flags, response assembly
    """

    # ── Step 1: Common context (profile → tool_graph + runs) ──────────────

    common = await resolve_common_context(
        conn, redis,
        profile_id=profile_id,
        group_id=group_id,
        bypass_cache=bypass_cache,
    )

    if common is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    profile = common.profile

    # ── Step 2: Persona artifact context ──────────────────────────────────

    persona = await resolve_persona_context(
        conn, redis,
        persona_id=persona_id,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=profile.department_ids,
        parameter_ids=parameter_ids,
        color_search=color_search,
        icon_search=icon_search,
        descriptions_search=descriptions_search,
        instructions_search=instructions_search,
        color_show_selected=color_show_selected,
        icon_show_selected=icon_show_selected,
        bypass_cache=bypass_cache,
    )

    # ── Step 3: Access check ──────────────────────────────────────────────

    if persona_id is not None:
        if persona.artifact_id is None:
            raise HTTPException(
                status_code=404,
                detail=f"Persona {persona_id} not found",
            )

        persona_department_ids = [d.id for d in persona.resources["departments"].selected]
        if not has_access(profile.role, profile.department_ids, persona_department_ids):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this persona.",
            )

    # ── Step 4: Tool scoring ──────────────────────────────────────────────

    scores = score_tools(common.tool_graph, PERSONA_RESOURCES)

    agent_ids: dict[str, UUID | None] = {
        r: (scores.best[r].agent_id if scores.best.get(r) else None)
        for r in PERSONA_RESOURCES
    }

    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in PERSONA_RESOURCES
    }

    # ── Step 5: Permissions ───────────────────────────────────────────────

    persona_department_ids = [d.id for d in persona.resources["departments"].selected]
    active_scenario_count = 1 if persona.entries["has_active_scenarios"] else 0

    can_edit = compute_can_edit(
        user_role=profile.role,
        persona_department_ids=persona_department_ids,
        active_scenario_count=active_scenario_count,
        user_department_ids=profile.department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=profile.role,
        persona_department_ids=persona_department_ids,
        active_scenario_count=active_scenario_count,
        user_department_ids=profile.department_ids,
    )

    # ── Step 6: Show / Required / AI flags ────────────────────────────────

    names_has_tools = scores.has_any.get("names", False)
    colors_has_tools = scores.has_any.get("colors", False)
    icons_has_tools = scores.has_any.get("icons", False)
    instructions_has_tools = scores.has_any.get("instructions", False)

    all_colors = dedupe_by_id(persona.resources["colors"].selected + persona.resources["colors"].suggestions)
    all_icons = dedupe_by_id(persona.resources["icons"].selected + persona.resources["icons"].suggestions)
    all_departments = dedupe_by_id(persona.resources["departments"].selected + persona.resources["departments"].suggestions)
    all_examples = dedupe_by_id(persona.resources["examples"].selected + persona.resources["examples"].suggestions)
    all_parameters = dedupe_by_id(persona.resources["parameters"].selected + persona.resources["parameters"].suggestions)
    all_voices = dedupe_by_id(persona.resources["voices"].selected + persona.resources["voices"].suggestions)

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
        "descriptions": compute_show_description(),
        "colors": compute_show_color(colors_has_tools, len(all_colors)),
        "icons": compute_show_icon(icons_has_tools, len(all_icons)),
        "instructions": compute_show_instructions(instructions_has_tools),
        "flags": compute_show_flag(),
        "departments": compute_show_departments(len(all_departments)),
        "parameter_fields": compute_show_parameter_fields(len(persona.entries["fields"])),
        "examples": compute_show_examples(len(all_examples)),
        "parameters": compute_show_parameters(len(all_parameters)),
        "voices": compute_show_voices(len(all_voices)),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "colors": compute_color_required(),
        "icons": compute_icon_required(),
        "instructions": compute_instructions_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "parameter_fields": compute_parameter_fields_required(),
        "examples": compute_examples_required(),
        "parameters": compute_parameters_required(),
        "voices": compute_voices_required(),
    }

    show_ai_generate_map = {
        r: compute_show_ai_generate(agent_ids, r)
        for r in PERSONA_RESOURCES
    }

    basic_show_ai_generate = any([
        show_ai_generate_map.get("names", False),
        show_ai_generate_map.get("descriptions", False),
        show_ai_generate_map.get("flags", False),
        show_ai_generate_map.get("departments", False),
    ])
    content_show_ai_generate = any([
        show_ai_generate_map.get("instructions", False),
        show_ai_generate_map.get("examples", False),
        show_ai_generate_map.get("voices", False),
    ])
    parameters_step_show_ai_generate = any([
        show_ai_generate_map.get("parameters", False),
        show_ai_generate_map.get("parameter_fields", False),
    ])

    # ── Step 7: Response assembly ─────────────────────────────────────────

    all_flags = dedupe_by_id(persona.resources["flags"].selected + persona.resources["flags"].suggestions)
    persona_flags = [
        PersonaFlagConfig(
            key=f.name,
            label=f.name,
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            generated=f.generated,
        )
        for f in all_flags
        if f.id
    ]

    current_flag = None
    if persona.resources["flags"].selected:
        f = persona.resources["flags"].selected[0]
        current_flag = PersonaFlagConfig(
            key=f.name,
            label=f.name,
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            generated=f.generated,
        )

    resolved_parameter_ids = list(
        {str(pf.parameter_id) for pf in persona.resources["parameter_fields"].selected if pf.parameter_id}
    )

    suggestions_map = {
        "names": [n.id for n in persona.resources["names"].suggestions],
        "descriptions": [d.id for d in persona.resources["descriptions"].suggestions],
        "colors": [c.id for c in persona.resources["colors"].suggestions],
        "icons": [i.id for i in persona.resources["icons"].suggestions],
        "instructions": [i.id for i in persona.resources["instructions"].suggestions],
        "departments": [d.id for d in persona.resources["departments"].suggestions],
        "parameter_fields": [],
        "examples": [e.id for e in persona.resources["examples"].suggestions],
        "parameters": [p.id for p in persona.resources["parameters"].suggestions],
        "voices": [v.id for v in persona.resources["voices"].suggestions],
    }

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    all_names = dedupe_by_id(persona.resources["names"].selected + persona.resources["names"].suggestions)
    all_descriptions = dedupe_by_id(persona.resources["descriptions"].selected + persona.resources["descriptions"].suggestions)
    all_instructions = dedupe_by_id(persona.resources["instructions"].selected + persona.resources["instructions"].suggestions)

    return GetPersonaApiResponse(
        # Context
        actor_name=profile.name,
        persona_exists=persona.artifact_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=persona.draft_version,
        group_id=group_id,
        # Step-level AI generation flags
        basic_show_ai_generate=basic_show_ai_generate,
        content_show_ai_generate=content_show_ai_generate,
        parameters_step_show_ai_generate=parameters_step_show_ai_generate,
        # Per-resource sections
        names=PersonaNameSection(
            **_section("names"),
            resource=persona.resources["names"].selected[0] if persona.resources["names"].selected else None,
            resources=all_names,
        ),
        descriptions=PersonaDescriptionSection(
            **_section("descriptions"),
            resource=persona.resources["descriptions"].selected[0] if persona.resources["descriptions"].selected else None,
            resources=all_descriptions,
        ),
        colors=PersonaColorSection(
            **_section("colors"),
            resource=persona.resources["colors"].selected[0] if persona.resources["colors"].selected else None,
            resources=all_colors,
        ),
        icons=PersonaIconSection(
            **_section("icons"),
            resource=persona.resources["icons"].selected[0] if persona.resources["icons"].selected else None,
            resources=all_icons,
        ),
        instructions=PersonaInstructionSection(
            **_section("instructions"),
            resource=persona.resources["instructions"].selected[0] if persona.resources["instructions"].selected else None,
            resources=all_instructions,
        ),
        flags=PersonaFlagSection(
            **_section("flags"),
            current=current_flag,
            resources=persona_flags,
        ),
        departments=PersonaDepartmentSection(
            **_section("departments"),
            current=persona.resources["departments"].selected,
            resources=all_departments,
        ),
        parameter_fields=PersonaParameterFieldSection(
            **_section("parameter_fields"),
            current=persona.resources["parameter_fields"].selected,
            resources=persona.resources["parameter_fields"].suggestions,
        ),
        examples=PersonaExampleSection(
            **_section("examples"),
            current=persona.resources["examples"].selected,
            resources=all_examples,
        ),
        parameters=PersonaParameterSection(
            **_section("parameters"),
            current=[p for p in persona.resources["parameters"].selected],
            resources=all_parameters,
        ),
        voices=PersonaVoiceSection(
            **_section("voices"),
            current=persona.resources["voices"].selected,
            resources=all_voices,
        ),
        # Fields catalog
        fields=persona.entries["fields"],
        # Resolved parameter IDs
        resolved_parameter_ids=resolved_parameter_ids or None,
    )


# ---------------------------------------------------------------------------
# get_persona_websocket — stub (to be rewritten with infra functions)
# ---------------------------------------------------------------------------


async def get_persona_websocket(*args, **kwargs):
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_persona_websocket needs to be rewritten with infra functions"
    )


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=GetPersonaApiResponse)
async def get_persona(
    request: GetPersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPersonaApiResponse:
    """Get persona information using composable infra architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Resolve group_id: client provides it, or create a new one
        group_id = request.group_id
        if not group_id:
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) "
                "VALUES (NOW(), NOW()) RETURNING id"
            )

        redis = get_redis_client()

        response_data = await get_persona_client(
            conn, redis,
            profile_id=profile_id,
            persona_id=request.persona_id,
            draft_id=request.draft_id,
            group_id=group_id,
            parameter_ids=[UUID(pid) for pid in request.parameter_ids]
            if request.parameter_ids
            else None,
            color_search=request.color_search,
            icon_search=request.icon_search,
            descriptions_search=request.descriptions_search,
            instructions_search=request.instructions_search,
            color_show_selected=request.color_show_selected,
            icon_show_selected=request.icon_show_selected,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "personas"
        response.headers["X-Cache-Hit"] = "0"

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
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
