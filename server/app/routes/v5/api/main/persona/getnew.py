"""Persona GET endpoint — new architecture using infra functions.

Replaces the monolithic get_persona_internal with composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_persona_context — artifact + draft → merged + hydrated resources
  3. score_tools — tool graph + artifact resources → per-resource tool picks
  4. Pure Python — permissions, show/required flags, response assembly

This file exists for comparison with the existing get.py.
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.common_context import CommonContext, resolve_common_context
from app.infra.persona_context import (
    PersonaArtifactContext,
    ResourcePair,
    resolve_persona_context,
)
from app.infra.tool_graph import ArtifactToolScores, score_tools
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


# ---------------------------------------------------------------------------
# get_persona_client_new — the new architecture
# ---------------------------------------------------------------------------


async def get_persona_client_new(
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
    """New persona GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. Early access check using profile context
      3. resolve_persona_context(persona_id, draft_id, ...) → hydrated resources
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

    effective_group_id = group_id

    persona = await resolve_persona_context(
        conn, redis,
        persona_id=persona_id,
        group_id=effective_group_id,
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
        # Persona must exist (artifact fetch returned it)
        if persona.persona_id is None:
            raise HTTPException(
                status_code=404,
                detail=f"Persona {persona_id} not found",
            )

        # Department-based access check
        persona_department_ids = [d.id for d in persona.departments.selected]
        if not has_access(profile.role, profile.department_ids, persona_department_ids):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this persona.",
            )

    # ── Step 4: Tool scoring ──────────────────────────────────────────────

    scores = score_tools(common.tool_graph, PERSONA_RESOURCES)

    # Build agent_ids map (resource -> agent_id) from scored tools
    agent_ids: dict[str, UUID | None] = {
        r: (scores.best[r].agent_id if scores.best.get(r) else None)
        for r in PERSONA_RESOURCES
    }

    # Build tool_ids map (resource -> tool_id) from scored tools
    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in PERSONA_RESOURCES
    }

    # ── Step 5: Permissions ───────────────────────────────────────────────

    persona_department_ids = [d.id for d in persona.departments.selected]

    active_scenario_count = 1 if persona.has_active_scenarios else 0

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

    # has_tools flags (from tool graph scoring)
    names_has_tools = scores.has_any.get("names", False)
    colors_has_tools = scores.has_any.get("colors", False)
    icons_has_tools = scores.has_any.get("icons", False)
    instructions_has_tools = scores.has_any.get("instructions", False)

    # Dedupe selected + suggestions for show counts
    all_colors = _dedupe_by_id(persona.colors.selected + persona.colors.suggestions)
    all_icons = _dedupe_by_id(persona.icons.selected + persona.icons.suggestions)
    all_departments = _dedupe_by_id(persona.departments.selected + persona.departments.suggestions)
    all_examples = _dedupe_by_id(persona.examples.selected + persona.examples.suggestions)
    all_parameters = _dedupe_by_id(persona.parameters.selected + persona.parameters.suggestions)
    all_voices = _dedupe_by_id(persona.voices.selected + persona.voices.suggestions)

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
        "descriptions": compute_show_description(),
        "colors": compute_show_color(colors_has_tools, len(all_colors)),
        "icons": compute_show_icon(icons_has_tools, len(all_icons)),
        "instructions": compute_show_instructions(instructions_has_tools),
        "flags": compute_show_flag(),
        "departments": compute_show_departments(len(all_departments)),
        "parameter_fields": compute_show_parameter_fields(len(persona.fields)),
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

    # Per-resource AI generate flags
    show_ai_generate_map = {
        r: compute_show_ai_generate(agent_ids, r)
        for r in PERSONA_RESOURCES
    }

    # Step-level AI generation flags
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

    # Transform flags to enriched PersonaFlagConfig
    all_flags = _dedupe_by_id(persona.flags.selected + persona.flags.suggestions)
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
    if persona.flags.selected:
        f = persona.flags.selected[0]
        current_flag = PersonaFlagConfig(
            key=f.name,
            label=f.name,
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            generated=f.generated,
        )

    # Resolved parameter IDs from saved parameter_fields
    resolved_parameter_ids = list(
        {str(pf.parameter_id) for pf in persona.parameter_fields.selected if pf.parameter_id}
    )

    # Suggestion ID lists
    suggestions_map = {
        "names": [n.id for n in persona.names.suggestions],
        "descriptions": [d.id for d in persona.descriptions.suggestions],
        "colors": [c.id for c in persona.colors.suggestions],
        "icons": [i.id for i in persona.icons.suggestions],
        "instructions": [i.id for i in persona.instructions.suggestions],
        "departments": [d.id for d in persona.departments.suggestions],
        "parameter_fields": [],
        "examples": [e.id for e in persona.examples.suggestions],
        "parameters": [p.id for p in persona.parameters.suggestions],
        "voices": [v.id for v in persona.voices.suggestions],
    }

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    # Dedupe merged lists (selected + suggestions) for the `resources` field
    all_names = _dedupe_by_id(persona.names.selected + persona.names.suggestions)
    all_descriptions = _dedupe_by_id(persona.descriptions.selected + persona.descriptions.suggestions)
    all_instructions = _dedupe_by_id(persona.instructions.selected + persona.instructions.suggestions)

    return GetPersonaApiResponse(
        # Context
        actor_name=profile.name,
        persona_exists=persona.persona_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=persona.draft_version,
        group_id=effective_group_id,
        # Step-level AI generation flags
        basic_show_ai_generate=basic_show_ai_generate,
        content_show_ai_generate=content_show_ai_generate,
        parameters_step_show_ai_generate=parameters_step_show_ai_generate,
        # Per-resource sections
        names=PersonaNameSection(
            **_section("names"),
            resource=persona.names.selected[0] if persona.names.selected else None,
            resources=all_names,
        ),
        descriptions=PersonaDescriptionSection(
            **_section("descriptions"),
            resource=persona.descriptions.selected[0] if persona.descriptions.selected else None,
            resources=all_descriptions,
        ),
        colors=PersonaColorSection(
            **_section("colors"),
            resource=persona.colors.selected[0] if persona.colors.selected else None,
            resources=all_colors,
        ),
        icons=PersonaIconSection(
            **_section("icons"),
            resource=persona.icons.selected[0] if persona.icons.selected else None,
            resources=all_icons,
        ),
        instructions=PersonaInstructionSection(
            **_section("instructions"),
            resource=persona.instructions.selected[0] if persona.instructions.selected else None,
            resources=all_instructions,
        ),
        flags=PersonaFlagSection(
            **_section("flags"),
            current=current_flag,
            resources=persona_flags,
        ),
        departments=PersonaDepartmentSection(
            **_section("departments"),
            current=persona.departments.selected,
            resources=all_departments,
        ),
        parameter_fields=PersonaParameterFieldSection(
            **_section("parameter_fields"),
            current=persona.parameter_fields.selected,
            resources=persona.parameter_fields.suggestions,
        ),
        examples=PersonaExampleSection(
            **_section("examples"),
            current=persona.examples.selected,
            resources=all_examples,
        ),
        parameters=PersonaParameterSection(
            **_section("parameters"),
            current=[p for p in persona.parameters.selected],
            resources=all_parameters,
        ),
        voices=PersonaVoiceSection(
            **_section("voices"),
            current=persona.voices.selected,
            resources=all_voices,
        ),
        # Fields catalog
        fields=persona.fields,
        # Resolved parameter IDs
        resolved_parameter_ids=resolved_parameter_ids or None,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _dedupe_by_id(items: list) -> list:
    """Preserve order while deduplicating by .id attribute."""
    seen: set = set()
    output: list = []
    for item in items:
        item_id = getattr(item, "id", None)
        if item_id and item_id not in seen:
            seen.add(item_id)
            output.append(item)
    return output
