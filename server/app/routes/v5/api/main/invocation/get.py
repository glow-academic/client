"""Invocation bundle artifact endpoint.

Section-first three-layer implementation (mirrors training/bundle.py):
1) get_invocation_internal() - MV view -> hydrate all 9 -> filter current
2) get_invocation_client() - HTTP section-first payload formatter
"""

import asyncio
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any, TypeVar, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Request

from app.infra.globals import get_pool
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.invocation.types import (
    BaseSuiteSection,
    GetInvocationApiRequest,
    GetSuiteRequest,
    GetSuiteResponse,
    GetSuiteWebsocketResponse,
    SuiteDepartmentSection,
    SuiteInstructionSection,
    SuiteKeySection,
    SuiteModelSection,
    SuitePromptSection,
    SuiteReasoningLevelSection,
    SuiteTemperatureLevelSection,
    SuiteToolSection,
    SuiteVoiceSection,
    SuiteWebsocketEntries,
    SuiteWebsocketResources,
)
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.entries.suite.get import get_suite_view_internal
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.departments.get import get_departments_internal
from app.routes.v5.tools.resources.instructions.get import get_instructions_internal
from app.routes.v5.tools.resources.keys.get import get_keys_internal
from app.routes.v5.tools.resources.models.get import get_models_internal
from app.routes.v5.tools.resources.profiles.get import get_profiles_internal
from app.routes.v5.tools.resources.prompts.get import get_prompts_internal
from app.routes.v5.tools.resources.providers.get import get_providers_internal
from app.routes.v5.tools.resources.reasoning_levels.get import (
    get_reasoning_levels_internal,
)
from app.routes.v5.tools.resources.temperature_levels.get import (
    get_temperature_levels_internal,
)
from app.routes.v5.tools.resources.tools.get import get_tools
from app.routes.v5.tools.resources.voices.get import get_voices_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Constants
# =============================================================================

BENCHMARK_BUNDLE_RESOURCES: set[str] = {
    "departments",
    "models",
    "prompts",
    "instructions",
    "voices",
    "temperature_levels",
    "reasoning_levels",
    "tools",
    "keys",
}

# =============================================================================
# Internal Data
# =============================================================================


@dataclass
class SuiteInternalData:
    suite_entry_id: UUID
    benchmark_id: UUID | None
    profile_has_access: bool
    group_id: UUID | None = None
    draft_version: int | None = None
    draft_item: Any | None = None
    # Per-resource: all (suggestions) and current (selected)
    all_resources: dict[str, list[Any]] = field(default_factory=dict)
    current_resources: dict[str, list[Any]] = field(default_factory=dict)
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    # Config chain
    config_agents: list[Any] = field(default_factory=list)
    config_models: list[Any] = field(default_factory=list)
    config_providers: list[Any] = field(default_factory=list)
    config_tools: list[Any] = field(default_factory=list)


# =============================================================================
# Helpers
# =============================================================================

T = TypeVar("T")


def _filter_by_ids(items: list[T], ids: list[UUID], id_attr: str) -> list[T]:
    if not items or not ids:
        return []
    id_set = {str(i) for i in ids}
    output: list[T] = []
    for item in items:
        value = getattr(item, id_attr, None)
        if value and str(value) in id_set:
            output.append(item)
    return output


# Resource key -> (view_data attr for IDs, get_*_internal func, id_attr for filtering)
RESOURCE_CONFIG: list[tuple[str, str, Any, str]] = [
    ("departments", "department_ids", get_departments_internal, "department_id"),
    ("models", "model_ids", get_models_internal, "id"),
    ("prompts", "prompt_ids", get_prompts_internal, "id"),
    ("instructions", "instruction_ids", get_instructions_internal, "id"),
    ("voices", "voice_ids", get_voices_internal, "id"),
    (
        "temperature_levels",
        "temperature_level_ids",
        get_temperature_levels_internal,
        "id",
    ),
    (
        "reasoning_levels",
        "reasoning_level_ids",
        get_reasoning_levels_internal,
        "id",
    ),
    ("tools", "tool_ids", get_tools, "id"),
    ("keys", "key_ids", get_keys_internal, "id"),
]

# =============================================================================
# Internal fetch
# =============================================================================


async def get_invocation_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    suite_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> SuiteInternalData:
    """Shared IDs-first + hydration internal fetch for benchmark bundle artifact."""
    from app.routes.v5.tools.entries.suite_drafts.get import (
        get_suite_drafts_entries_internal,
    )
    from app.sql.types import QGetSuiteDraftsEntriesV4Item

    # 1. Fetch MV view data (all 9 ID arrays)
    async with pool.acquire() as conn:
        view_data = await get_suite_view_internal(
            conn=conn,
            profile_id=profile_id,
            suite_entry_id=suite_entry_id,
        )

    if not view_data.suite_entry_id:
        raise HTTPException(status_code=404, detail="Benchmark bundle not found")

    if not view_data.profile_has_access:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this benchmark bundle.",
        )

    # 2. Fetch draft if provided
    draft_item: QGetSuiteDraftsEntriesV4Item | None = None
    if draft_id is not None:
        async with pool.acquire() as conn:
            draft_items = await get_suite_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    # 3. Build selected IDs — draft overrides MV when present
    selected_ids: dict[str, list[UUID]] = {}
    for resource_key, view_attr, _fetch_fn, _id_attr in RESOURCE_CONFIG:
        if draft_item is not None:
            draft_ids_val = getattr(draft_item, view_attr, None)
            selected_ids[resource_key] = list(draft_ids_val) if draft_ids_val else []
        else:
            mv_ids = list(getattr(view_data, view_attr, []) or [])
            selected_ids[resource_key] = mv_ids

    # 4. Hydrate ALL 9 resources in parallel
    FetchFn = Callable[..., Coroutine[Any, Any, list[Any]]]

    async def _fetch_resource(
        resource_key: str,
        view_attr: str,
        fetch_fn: FetchFn,
    ) -> tuple[str, list[Any]]:
        all_ids = list(getattr(view_data, view_attr, []) or [])
        if not all_ids:
            return (resource_key, [])
        async with pool.acquire() as conn:
            return (resource_key, await fetch_fn(conn, all_ids, bypass_cache))

    fetch_tasks = [_fetch_resource(rk, va, fn) for rk, va, fn, _ia in RESOURCE_CONFIG]
    fetch_results = await asyncio.gather(*fetch_tasks)

    all_resources: dict[str, list[Any]] = {}
    for resource_key, items in fetch_results:
        all_resources[resource_key] = items

    # 5. Filter current selections from full lists
    current_resources: dict[str, list[Any]] = {}
    for resource_key, _view_attr, _fetch_fn, id_attr in RESOURCE_CONFIG:
        current_resources[resource_key] = _filter_by_ids(
            all_resources.get(resource_key, []),
            selected_ids.get(resource_key, []),
            id_attr,
        )

    # 6. Settings-based agent resolution + config chain
    async with pool.acquire() as conn:
        settings_data = await get_auth_settings_internal(conn, profile_id, bypass_cache)
    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, BENCHMARK_BUNDLE_RESOURCES
    )

    # Config chain (agents + tools already hydrated, models need fetch)
    config_agents = list(settings_data.settings_agents)
    config_tools = list(settings_data.settings_tools)

    config_model_ids = list(
        dict.fromkeys(a.model_id for a in settings_data.settings_agents if a.model_id)
    )
    config_models: list[Any] = []
    if config_model_ids:
        async with pool.acquire() as conn:
            config_models = await get_models_internal(
                conn, config_model_ids, bypass_cache
            )

    config_provider_ids = list(
        dict.fromkeys(m.provider_id for m in config_models if m.provider_id)
    )
    config_providers: list[Any] = []
    if config_provider_ids:
        async with pool.acquire() as conn:
            config_providers = await get_providers_internal(
                conn, config_provider_ids, bypass_cache
            )

    return SuiteInternalData(
        suite_entry_id=view_data.suite_entry_id,
        benchmark_id=view_data.benchmark_id,
        profile_has_access=view_data.profile_has_access,
        group_id=draft_item.group_id if draft_item else None,
        draft_version=draft_item.version if draft_item else None,
        draft_item=draft_item,
        all_resources=all_resources,
        current_resources=current_resources,
        resource_agent_ids=agent_ids,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
    )


# =============================================================================
# Client/BFF Layer
# =============================================================================

# Section class mapping for building typed sections
_SECTION_CLASSES: dict[str, type] = {
    "departments": SuiteDepartmentSection,
    "models": SuiteModelSection,
    "prompts": SuitePromptSection,
    "instructions": SuiteInstructionSection,
    "voices": SuiteVoiceSection,
    "temperature_levels": SuiteTemperatureLevelSection,
    "reasoning_levels": SuiteReasoningLevelSection,
    "tools": SuiteToolSection,
    "keys": SuiteKeySection,
}


async def get_invocation_client(
    pool: asyncpg.Pool,
    profile_id: UUID,
    suite_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetSuiteResponse:
    """HTTP-facing bundle response formatter — section-first pattern."""
    data = await get_invocation_internal(
        pool=pool,
        profile_id=profile_id,
        suite_entry_id=suite_entry_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    def _section(resource_key: str) -> BaseSuiteSection:
        cls = _SECTION_CLASSES[resource_key]
        return cls(
            show=True,
            required=False,
            show_ai_generate=data.resource_agent_ids.get(resource_key) is not None,
            current=data.current_resources.get(resource_key) or None,
            resources=data.all_resources.get(resource_key) or None,
        )

    return GetSuiteResponse(
        suite_entry_id=data.suite_entry_id,
        benchmark_id=data.benchmark_id,
        profile_has_access=data.profile_has_access,
        draft_version=data.draft_version,
        departments=_section("departments"),
        models=_section("models"),
        prompts=_section("prompts"),
        instructions=_section("instructions"),
        voices=_section("voices"),
        temperature_levels=_section("temperature_levels"),
        reasoning_levels=_section("reasoning_levels"),
        tools=_section("tools"),
        keys=_section("keys"),
        config_agents=data.config_agents or None,
        config_models=data.config_models or None,
        config_providers=data.config_providers or None,
        config_tools=data.config_tools or None,
    )


# =============================================================================
# WebSocket Layer
# =============================================================================


async def get_invocation_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    suite_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetSuiteWebsocketResponse:
    """Thin wrapper for websocket consumers — selected resources only."""

    async def fetch_bundle():
        return await get_invocation_internal(
            pool=pool,
            profile_id=profile_id,
            suite_entry_id=suite_entry_id,
            draft_id=draft_id,
            bypass_cache=bypass_cache,
        )

    async def fetch_config_profile():
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn, [profile_id], bypass_cache)

    async def fetch_runs_today():
        from datetime import UTC, datetime

        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as conn:
            return await get_run_list_entries_internal(
                conn=conn,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    (data, config_profile_result, runs_result) = await asyncio.gather(
        fetch_bundle(),
        fetch_config_profile(),
        fetch_runs_today(),
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_args = None
    config_args_outputs = None
    config_tools_list = data.config_tools or []
    if config_tools_list:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools_list:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)

        if all_args_ids or all_args_output_ids:

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args(
                        c, list(set(all_args_ids)), cache=cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c, list(set(all_args_output_ids)), cache=cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    websocket_resources = SuiteWebsocketResources(
        departments=data.current_resources.get("departments") or None,
        models=data.current_resources.get("models") or None,
        prompts=data.current_resources.get("prompts") or None,
        instructions=data.current_resources.get("instructions") or None,
        voices=data.current_resources.get("voices") or None,
        temperature_levels=data.current_resources.get("temperature_levels") or None,
        reasoning_levels=data.current_resources.get("reasoning_levels") or None,
        tools=data.current_resources.get("tools") or None,
        keys=data.current_resources.get("keys") or None,
    )

    return GetSuiteWebsocketResponse(
        entries=SuiteWebsocketEntries(
            draft_suite=data.draft_item,
            runs=runs_result,
        ),
        resources=websocket_resources,
        params=GetInvocationApiRequest(
            benchmark_entry_id=suite_entry_id, draft_id=draft_id
        ),
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=data.config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


# =============================================================================
# Route Handler
# =============================================================================


@router.post("/get", response_model=GetSuiteResponse)
async def invocation_get(
    request: GetSuiteRequest,
    http_request: Request,
) -> GetSuiteResponse:
    """Get hydrated resources for benchmark bundle customization."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)

        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        return await get_invocation_client(
            pool=pool,
            profile_id=cast(UUID, profile_id),
            suite_entry_id=request.suite_entry_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="invocation_get",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
