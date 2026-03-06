"""Invocation GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_invocation_context — draft-only → hydrated resources
  3. score_tools — tool graph + artifact resources → per-resource tool picks
  4. Pure Python — response assembly
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from redis.asyncio import Redis

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_redis_client
from app.infra.invocation_context import resolve_invocation_context
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.invocation.types import (
    BaseSuiteSection,
    GetSuiteRequest,
    GetSuiteResponse,
    GetSuiteWebsocketResponse,
    SuiteDepartmentSection,
    SuiteDescriptionSection,
    SuiteEndpointSection,
    SuiteFlagSection,
    SuiteKeySection,
    SuiteModalitySection,
    SuiteNameSection,
    SuitePricingSection,
    SuiteQualitySection,
    SuiteReasoningLevelSection,
    SuiteTemperatureLevelSection,
    SuiteValueSection,
    SuiteVoiceSection,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Constants
# =============================================================================

INVOCATION_BUNDLE_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "values",
    "flags",
    "departments",
    "keys",
    "endpoints",
    "modalities",
    "temperature_levels",
    "pricing",
    "reasoning_levels",
    "qualities",
    "voices",
}

# Section class mapping for building typed sections
_SECTION_CLASSES: dict[str, type] = {
    "names": SuiteNameSection,
    "descriptions": SuiteDescriptionSection,
    "values": SuiteValueSection,
    "flags": SuiteFlagSection,
    "departments": SuiteDepartmentSection,
    "keys": SuiteKeySection,
    "endpoints": SuiteEndpointSection,
    "modalities": SuiteModalitySection,
    "temperature_levels": SuiteTemperatureLevelSection,
    "pricing": SuitePricingSection,
    "reasoning_levels": SuiteReasoningLevelSection,
    "qualities": SuiteQualitySection,
    "voices": SuiteVoiceSection,
}


# =============================================================================
# Client/BFF Layer — composable infra architecture
# =============================================================================


async def get_invocation_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    test_id: UUID,
    draft_id: UUID | None = None,
    group_id: UUID,
    descriptions_search: str | None = None,
    bypass_cache: bool = False,
) -> GetSuiteResponse:
    """HTTP-facing bundle response using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_invocation_context(group_id, draft_id) → hydrated resources
      3. score_tools(tool_graph, INVOCATION_BUNDLE_RESOURCES) → per-resource tool picks
      4. Pure Python: response assembly
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

    # ── Step 2: Invocation context (draft-only) ───────────────────────────

    invocation = await resolve_invocation_context(
        conn,
        redis,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=profile.department_ids,
        descriptions_search=descriptions_search,
        bypass_cache=bypass_cache,
    )

    # ── Step 3: Tool scoring ──────────────────────────────────────────────

    scores = score_tools(common.tool_graph, INVOCATION_BUNDLE_RESOURCES)

    # ── Step 4: Response assembly ─────────────────────────────────────────

    def _section(resource_key: str) -> BaseSuiteSection:
        cls = _SECTION_CLASSES[resource_key]
        pair = invocation.resources.get(resource_key)
        if not pair:
            return cls(show=True, required=False)
        return cls(
            show=True,
            required=False,
            show_ai_generate=scores.best.get(resource_key) is not None,
            current=pair.selected or None,
            resources=pair.suggestions or None,
        )

    return GetSuiteResponse(
        test_id=test_id,
        profile_has_access=True,
        draft_version=invocation.draft_version,
        group_id=group_id,
        names=_section("names"),
        descriptions=_section("descriptions"),
        values=_section("values"),
        flags=_section("flags"),
        departments=_section("departments"),
        keys=_section("keys"),
        endpoints=_section("endpoints"),
        modalities=_section("modalities"),
        temperature_levels=_section("temperature_levels"),
        pricing=_section("pricing"),
        reasoning_levels=_section("reasoning_levels"),
        qualities=_section("qualities"),
        voices=_section("voices"),
    )


# =============================================================================
# WebSocket Layer (stub — to be rewritten with infra functions)
# =============================================================================


async def get_invocation_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    suite_entry_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetSuiteWebsocketResponse:
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_invocation_websocket needs to be rewritten with infra functions"
    )


# =============================================================================
# Route Handler
# =============================================================================


@router.post("/get", response_model=GetSuiteResponse)
async def invocation_get(
    request: GetSuiteRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
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
        redis = get_redis_client()

        return await get_invocation_client(
            conn,
            redis,
            profile_id=profile_id,
            test_id=request.test_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            descriptions_search=request.descriptions_search,
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
