"""Agent GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_agent_permissions_context — fail-fast 404/403
  3. resolve_agent_context — artifact + draft → merged + hydrated resources
  4. score_tools — tool graph + artifact resources → per-resource tool picks
  5. Pure Python — permissions, show/required flags, response assembly
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from redis.asyncio import Redis

from app.infra.agent_context import resolve_agent_context
from app.infra.agent_permissions_context import resolve_agent_permissions_context
from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_redis_client
from app.infra.helpers import dedupe_by_id
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.agent.permissions import (
    AGENT_BASIC_RESOURCES,
    AGENT_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_instructions_required,
    compute_models_required,
    compute_name_required,
    compute_prompts_required,
    compute_qualities_required,
    compute_reasoning_levels_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_instructions,
    compute_show_models,
    compute_show_name,
    compute_show_prompts,
    compute_show_qualities,
    compute_show_reasoning_levels,
    compute_show_temperature_levels,
    compute_show_tools,
    compute_show_voices,
    compute_temperature_levels_required,
    compute_tools_required,
    compute_voices_required,
    get_missing_tools,
    has_access,
)
from app.routes.v5.api.main.agent.types import (
    AgentDepartmentSection,
    AgentDescriptionSection,
    AgentFlagConfig,
    AgentFlagSection,
    AgentInstructionSection,
    AgentModelSection,
    AgentNameSection,
    AgentPromptSection,
    AgentQualitySection,
    AgentReasoningLevelSection,
    AgentTemperatureLevelSection,
    AgentToolSection,
    AgentVoiceSection,
    GetAgentApiRequest,
    GetAgentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# Agent-specific flag names
AGENT_FLAG_NAMES = {"agent_active"}


# ---------------------------------------------------------------------------
# get_agent_client — composable infra architecture
# ---------------------------------------------------------------------------


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'agent_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("agent_", "")
    label = key.replace("_", " ").title()
    return (key, label)


async def get_agent_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    agent_id: UUID | None,
    draft_id: UUID | None = None,
    group_id: UUID,
    bypass_cache: bool = False,
) -> GetAgentApiResponse:
    """Agent GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_agent_permissions_context → access check (404, 403, fail fast)
      3. resolve_agent_context(agent_id, draft_id, ...) → hydrated resources
      4. score_tools(tool_graph, AGENT_RESOURCES) → per-resource tool picks
      5. Pure Python: permissions, show/required/AI flags, response assembly
    """

    # ── Step 1: Common context (profile → tool_graph + runs) ──────────────

    common = await resolve_common_context(
        conn,
        redis,
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

    # ── Step 2: Permissions check (fail fast before full hydration) ──────

    perms = None
    if agent_id is not None:
        perms = await resolve_agent_permissions_context(conn, agent_id)

        if not perms.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Agent {agent_id} not found",
            )

        if not has_access(profile.role, profile.department_ids, perms.department_ids):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this agent. It may be restricted to other departments.",
            )

    # ── Step 3: Agent artifact context ────────────────────────────────────

    agent_ctx = await resolve_agent_context(
        conn,
        redis,
        agent_id=agent_id,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=profile.department_ids,
        bypass_cache=bypass_cache,
    )

    # ── Step 4: Tool scoring ──────────────────────────────────────────────

    scores = score_tools(common.tool_graph, AGENT_RESOURCES)

    agent_ids: dict[str, UUID | None] = {
        r: (scores.best[r].agent_id if scores.best.get(r) else None)
        for r in AGENT_RESOURCES
    }

    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in AGENT_RESOURCES
    }

    # ── Step 5: Permissions ───────────────────────────────────────────────

    names_has_tools = scores.has_any.get("names", False)
    descriptions_has_tools = scores.has_any.get("descriptions", False)
    models_has_tools = scores.has_any.get("models", False)
    prompts_has_tools = scores.has_any.get("prompts", False)
    instructions_has_tools = scores.has_any.get("instructions", False)
    departments_has_tools = scores.has_any.get("departments", False)
    tools_has_tools = scores.has_any.get("tools", False)
    temperature_levels_has_tools = scores.has_any.get("temperature_levels", False)
    reasoning_levels_has_tools = scores.has_any.get("reasoning_levels", False)
    voices_has_tools = scores.has_any.get("voices", False)
    qualities_has_tools = scores.has_any.get("qualities", False)

    missing_tools = get_missing_tools(
        names_has_tools=names_has_tools,
        models_has_tools=models_has_tools,
        prompts_has_tools=prompts_has_tools,
        instructions_has_tools=instructions_has_tools,
    )

    has_agent_access = has_access(
        profile.role,
        profile.department_ids,
        perms.department_ids if perms else [],
    )

    can_edit = compute_can_edit(
        user_role=profile.role,
        has_agent_access=has_agent_access,
        missing_tools=missing_tools,
        agent_id=agent_id,
    )

    disabled_reason = compute_disabled_reason(
        user_role=profile.role,
        has_agent_access=has_agent_access,
        missing_tools=missing_tools,
        agent_id=agent_id,
    )

    # ── Step 6: Show / Required / AI flags ────────────────────────────────

    all_departments = dedupe_by_id(
        agent_ctx.resources["departments"].selected
        + agent_ctx.resources["departments"].suggestions
    )
    all_tools = dedupe_by_id(
        agent_ctx.resources["tools"].selected
        + agent_ctx.resources["tools"].suggestions
    )

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
        "descriptions": compute_show_description(descriptions_has_tools),
        "models": compute_show_models(models_has_tools),
        "prompts": compute_show_prompts(prompts_has_tools),
        "instructions": compute_show_instructions(instructions_has_tools),
        "flags": compute_show_flag(),
        "departments": compute_show_departments(
            departments_has_tools, len(all_departments) > 0
        ),
        "tools": compute_show_tools(tools_has_tools, len(all_tools) > 0),
        "temperature_levels": compute_show_temperature_levels(
            temperature_levels_has_tools
        ),
        "reasoning_levels": compute_show_reasoning_levels(reasoning_levels_has_tools),
        "voices": compute_show_voices(voices_has_tools),
        "qualities": compute_show_qualities(qualities_has_tools),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "models": compute_models_required(),
        "prompts": compute_prompts_required(),
        "instructions": compute_instructions_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(show_flags_map["departments"]),
        "tools": compute_tools_required(),
        "temperature_levels": compute_temperature_levels_required(),
        "reasoning_levels": compute_reasoning_levels_required(),
        "voices": compute_voices_required(),
        "qualities": compute_qualities_required(),
    }

    def compute_show_ai_generate(resource: str) -> bool:
        return agent_ids.get(resource) is not None

    show_ai_generate_map = {
        r: compute_show_ai_generate(r) for r in AGENT_RESOURCES
    }

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in AGENT_BASIC_RESOURCES
    )
    general_show_ai_generate = any(show_ai_generate_map.values())

    # ── Step 7: Response assembly ─────────────────────────────────────────

    # Flags — enriched format
    all_flags = dedupe_by_id(
        agent_ctx.resources["flags"].selected
        + agent_ctx.resources["flags"].suggestions
    )
    agent_flags = [
        AgentFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flags_map.get("flags", True),
            required=required_flags_map.get("flags", False),
            generated=flag.generated,
        )
        for flag in all_flags
        if flag.id
    ]

    current_flags = [
        AgentFlagConfig(
            key=derive_flag_key_and_label(f.name)[0],
            label=derive_flag_key_and_label(f.name)[1],
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            show=show_flags_map.get("flags", True),
            required=required_flags_map.get("flags", False),
            generated=f.generated,
        )
        for f in agent_ctx.resources["flags"].selected
        if f.id
    ]

    # All resources — deduped selected + suggestions
    all_names = dedupe_by_id(
        agent_ctx.resources["names"].selected
        + agent_ctx.resources["names"].suggestions
    )
    all_descriptions = dedupe_by_id(
        agent_ctx.resources["descriptions"].selected
        + agent_ctx.resources["descriptions"].suggestions
    )
    all_models = dedupe_by_id(
        agent_ctx.resources["models"].selected
        + agent_ctx.resources["models"].suggestions
    )
    all_prompts = dedupe_by_id(
        agent_ctx.resources["prompts"].selected
        + agent_ctx.resources["prompts"].suggestions
    )
    all_instructions = dedupe_by_id(
        agent_ctx.resources["instructions"].selected
        + agent_ctx.resources["instructions"].suggestions
    )
    all_temperature_levels = dedupe_by_id(
        agent_ctx.resources["temperature_levels"].selected
        + agent_ctx.resources["temperature_levels"].suggestions
    )
    all_reasoning_levels = dedupe_by_id(
        agent_ctx.resources["reasoning_levels"].selected
        + agent_ctx.resources["reasoning_levels"].suggestions
    )
    all_voices = dedupe_by_id(
        agent_ctx.resources["voices"].selected
        + agent_ctx.resources["voices"].suggestions
    )
    all_qualities = dedupe_by_id(
        agent_ctx.resources["qualities"].selected
        + agent_ctx.resources["qualities"].suggestions
    )

    # Suggestions maps (IDs only)
    suggestions_map = {
        "names": [n.id for n in agent_ctx.resources["names"].suggestions],
        "descriptions": [
            d.id for d in agent_ctx.resources["descriptions"].suggestions
        ],
        "models": [m.id for m in agent_ctx.resources["models"].suggestions],
        "prompts": [p.id for p in agent_ctx.resources["prompts"].suggestions],
        "instructions": [
            i.id for i in agent_ctx.resources["instructions"].suggestions
        ],
        "departments": [
            d.id for d in agent_ctx.resources["departments"].suggestions
        ],
        "tools": [t.id for t in agent_ctx.resources["tools"].suggestions],
        "temperature_levels": [
            t.id for t in agent_ctx.resources["temperature_levels"].suggestions
        ],
        "reasoning_levels": [
            r.id for r in agent_ctx.resources["reasoning_levels"].suggestions
        ],
        "voices": [v.id for v in agent_ctx.resources["voices"].suggestions],
        "qualities": [q.id for q in agent_ctx.resources["qualities"].suggestions],
    }

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key, []),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    return GetAgentApiResponse(
        actor_name=profile.name,
        agent_exists=agent_ctx.artifact_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=agent_ctx.draft_version,
        group_id=group_id,
        basic_show_ai_generate=basic_show_ai_generate,
        general_show_ai_generate=general_show_ai_generate,
        names=AgentNameSection(
            **_section("names"),
            resource=agent_ctx.resources["names"].selected[0]
            if agent_ctx.resources["names"].selected
            else None,
            resources=all_names,
        ),
        descriptions=AgentDescriptionSection(
            **_section("descriptions"),
            resource=agent_ctx.resources["descriptions"].selected[0]
            if agent_ctx.resources["descriptions"].selected
            else None,
            resources=all_descriptions,
        ),
        models=AgentModelSection(
            **_section("models"),
            resource=agent_ctx.resources["models"].selected[0]
            if agent_ctx.resources["models"].selected
            else None,
            resources=all_models,
        ),
        prompts=AgentPromptSection(
            **_section("prompts"),
            resource=agent_ctx.resources["prompts"].selected[0]
            if agent_ctx.resources["prompts"].selected
            else None,
            resources=all_prompts,
        ),
        instructions=AgentInstructionSection(
            **_section("instructions"),
            resource=agent_ctx.resources["instructions"].selected[0]
            if agent_ctx.resources["instructions"].selected
            else None,
            resources=all_instructions,
        ),
        flags=AgentFlagSection(
            **_section("flags"),
            current=current_flags or None,
            resources=agent_flags,
        ),
        departments=AgentDepartmentSection(
            **_section("departments"),
            current=agent_ctx.resources["departments"].selected or None,
            resources=all_departments,
        ),
        tools=AgentToolSection(
            **_section("tools"),
            current=agent_ctx.resources["tools"].selected or None,
            resources=all_tools,
        ),
        temperature_levels=AgentTemperatureLevelSection(
            **_section("temperature_levels"),
            resource=agent_ctx.resources["temperature_levels"].selected[0]
            if agent_ctx.resources["temperature_levels"].selected
            else None,
            resources=all_temperature_levels,
        ),
        reasoning_levels=AgentReasoningLevelSection(
            **_section("reasoning_levels"),
            resource=agent_ctx.resources["reasoning_levels"].selected[0]
            if agent_ctx.resources["reasoning_levels"].selected
            else None,
            resources=all_reasoning_levels,
        ),
        voices=AgentVoiceSection(
            **_section("voices"),
            current=agent_ctx.resources["voices"].selected or None,
            resources=all_voices,
        ),
        qualities=AgentQualitySection(
            **_section("qualities"),
            current=agent_ctx.resources["qualities"].selected or None,
            resources=all_qualities,
        ),
    )


# ---------------------------------------------------------------------------
# get_agent_websocket — stub (to be rewritten with infra functions)
# ---------------------------------------------------------------------------


async def get_agent_websocket(*args, **kwargs):
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_agent_websocket needs to be rewritten with infra functions"
    )


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=GetAgentApiResponse)
async def get_agent(
    request: GetAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAgentApiResponse:
    """Get agent information using composable infra architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await get_agent_client(
            conn,
            redis,
            profile_id=profile_id,
            agent_id=request.agent_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "agents"
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
            operation="get_agent",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
