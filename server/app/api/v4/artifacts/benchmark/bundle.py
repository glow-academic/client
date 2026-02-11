"""Benchmark bundle artifact endpoint.

Section-first three-layer implementation (mirrors training/bundle.py):
1) get_benchmark_bundle_internal() - MV view → hydrate all 9 → filter current
2) get_benchmark_bundle_client() - HTTP section-first payload formatter
"""

import asyncio
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from typing import Annotated, Any, TypeVar, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.artifacts.benchmark.types import (
    BaseBenchmarkBundleSection,
    BenchmarkBundleDepartmentSection,
    BenchmarkBundleInstructionSection,
    BenchmarkBundleKeySection,
    BenchmarkBundleModelSection,
    BenchmarkBundlePromptSection,
    BenchmarkBundleReasoningLevelSection,
    BenchmarkBundleTemperatureLevelSection,
    BenchmarkBundleToolSection,
    BenchmarkBundleVoiceSection,
    GetBenchmarkBundleRequest,
    GetBenchmarkBundleResponse,
)
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.keys.get import get_keys_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.api.v4.resources.reasoning_levels.get import get_reasoning_levels_internal
from app.api.v4.resources.temperature_levels.get import get_temperature_levels_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.resources.voices.get import get_voices_internal
from app.api.v4.views.benchmark.bundle.get import get_benchmark_bundle_view_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


# =============================================================================
# Internal Data
# =============================================================================


@dataclass
class BenchmarkBundleInternalData:
    benchmark_bundle_entry_id: UUID
    benchmark_id: UUID | None
    profile_has_access: bool
    # Per-resource: all (suggestions) and current (selected)
    all_resources: dict[str, list[Any]] = field(default_factory=dict)
    current_resources: dict[str, list[Any]] = field(default_factory=dict)


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


# Resource key → (view_data attr for IDs, get_*_internal func, id_attr for filtering)
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
    ("tools", "tool_ids", get_tools_internal, "id"),
    ("keys", "key_ids", get_keys_internal, "id"),
]


# =============================================================================
# Internal fetch
# =============================================================================


async def get_benchmark_bundle_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    benchmark_bundle_entry_id: UUID,
    bypass_cache: bool = False,
) -> BenchmarkBundleInternalData:
    """Shared IDs-first + hydration internal fetch for benchmark bundle artifact."""
    # 1. Fetch MV view data (all 9 ID arrays)
    view_data = await get_benchmark_bundle_view_internal(
        conn=conn,
        profile_id=profile_id,
        benchmark_bundle_entry_id=benchmark_bundle_entry_id,
    )

    if not view_data.benchmark_bundle_entry_id:
        raise HTTPException(status_code=404, detail="Benchmark bundle not found")

    if not view_data.profile_has_access:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this benchmark bundle.",
        )

    # 2. Build selected IDs from MV (no draft override for now)
    selected_ids: dict[str, list[UUID]] = {}
    for resource_key, view_attr, _fetch_fn, _id_attr in RESOURCE_CONFIG:
        mv_ids = list(getattr(view_data, view_attr, []) or [])
        selected_ids[resource_key] = mv_ids

    # 3. Hydrate ALL 9 resources in parallel
    FetchFn = Callable[..., Coroutine[Any, Any, list[Any]]]

    async def _fetch_resource(
        resource_key: str,
        view_attr: str,
        fetch_fn: FetchFn,
    ) -> tuple[str, list[Any]]:
        all_ids = list(getattr(view_data, view_attr, []) or [])
        if not all_ids:
            return (resource_key, [])
        return (resource_key, await fetch_fn(conn, all_ids, bypass_cache))

    fetch_tasks = [_fetch_resource(rk, va, fn) for rk, va, fn, _ia in RESOURCE_CONFIG]
    fetch_results = await asyncio.gather(*fetch_tasks)

    all_resources: dict[str, list[Any]] = {}
    for resource_key, items in fetch_results:
        all_resources[resource_key] = items

    # 4. Filter current selections from full lists
    current_resources: dict[str, list[Any]] = {}
    for resource_key, _view_attr, _fetch_fn, id_attr in RESOURCE_CONFIG:
        current_resources[resource_key] = _filter_by_ids(
            all_resources.get(resource_key, []),
            selected_ids.get(resource_key, []),
            id_attr,
        )

    return BenchmarkBundleInternalData(
        benchmark_bundle_entry_id=view_data.benchmark_bundle_entry_id,
        benchmark_id=view_data.benchmark_id,
        profile_has_access=view_data.profile_has_access,
        all_resources=all_resources,
        current_resources=current_resources,
    )


# =============================================================================
# Client/BFF Layer
# =============================================================================


# Section class mapping for building typed sections
_SECTION_CLASSES: dict[str, type] = {
    "departments": BenchmarkBundleDepartmentSection,
    "models": BenchmarkBundleModelSection,
    "prompts": BenchmarkBundlePromptSection,
    "instructions": BenchmarkBundleInstructionSection,
    "voices": BenchmarkBundleVoiceSection,
    "temperature_levels": BenchmarkBundleTemperatureLevelSection,
    "reasoning_levels": BenchmarkBundleReasoningLevelSection,
    "tools": BenchmarkBundleToolSection,
    "keys": BenchmarkBundleKeySection,
}


async def get_benchmark_bundle_client(
    conn: asyncpg.Connection,
    profile_id: UUID,
    benchmark_bundle_entry_id: UUID,
    bypass_cache: bool = False,
) -> GetBenchmarkBundleResponse:
    """HTTP-facing bundle response formatter — section-first pattern."""
    data = await get_benchmark_bundle_internal(
        conn=conn,
        profile_id=profile_id,
        benchmark_bundle_entry_id=benchmark_bundle_entry_id,
        bypass_cache=bypass_cache,
    )

    def _section(resource_key: str) -> BaseBenchmarkBundleSection:
        cls = _SECTION_CLASSES[resource_key]
        return cls(
            show=True,
            required=False,
            show_ai_generate=False,
            current=data.current_resources.get(resource_key) or None,
            resources=data.all_resources.get(resource_key) or None,
        )

    return GetBenchmarkBundleResponse(
        benchmark_bundle_entry_id=data.benchmark_bundle_entry_id,
        benchmark_id=data.benchmark_id,
        profile_has_access=data.profile_has_access,
        departments=_section("departments"),
        models=_section("models"),
        prompts=_section("prompts"),
        instructions=_section("instructions"),
        voices=_section("voices"),
        temperature_levels=_section("temperature_levels"),
        reasoning_levels=_section("reasoning_levels"),
        tools=_section("tools"),
        keys=_section("keys"),
    )


# =============================================================================
# Route Handler
# =============================================================================


@router.post("/bundle/get", response_model=GetBenchmarkBundleResponse)
async def benchmark_bundle_get(
    request: GetBenchmarkBundleRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkBundleResponse:
    """Get hydrated resources for benchmark bundle customization."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        return await get_benchmark_bundle_client(
            conn=conn,
            profile_id=cast(UUID, profile_id),
            benchmark_bundle_entry_id=request.benchmark_bundle_entry_id,
            bypass_cache=bypass_cache,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="benchmark_bundle_get",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
