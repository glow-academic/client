"""Chat bundle artifact endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_chat_context — draft-only → hydrated resources
  3. score_tools — tool graph + artifact resources → per-resource tool picks
  4. Pure Python — show/required flags, response assembly
"""

from __future__ import annotations

from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from redis.asyncio import Redis

from app.infra.chat_context import resolve_chat_context
from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_redis_client
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.chat.permissions import CHAT_BUNDLE_RESOURCES
from app.routes.v5.api.main.chat.types import (
    BaseChatSection,
    ChatDepartmentSection,
    ChatDescriptionSection,
    ChatDocumentSection,
    ChatFieldSection,
    ChatFlagSection,
    ChatImageSection,
    ChatNameSection,
    ChatObjectiveSection,
    ChatOptionSection,
    ChatParameterFieldSection,
    ChatPersonaSection,
    ChatProblemStatementSection,
    ChatQuestionSection,
    ChatScenarioSection,
    ChatStartWebsocketEntries,
    ChatStartWebsocketResources,
    ChatVideoSection,
    GetChatRequest,
    GetChatResponse,
    GetChatStartWebsocketResponse,
)
from app.sql.types import (
    GetTrainingStartContextSqlParams,
    GetTrainingStartContextSqlRow,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

router = APIRouter()

SQL_PATH_START_CONTEXT = (
    "app/sql/queries/generate/training/get_training_start_context_complete.sql"
)

# Section class mapping for building typed sections
_SECTION_CLASSES: dict[str, type] = {
    "names": ChatNameSection,
    "descriptions": ChatDescriptionSection,
    "flags": ChatFlagSection,
    "departments": ChatDepartmentSection,
    "personas": ChatPersonaSection,
    "documents": ChatDocumentSection,
    "parameter_fields": ChatParameterFieldSection,
    "scenarios": ChatScenarioSection,
    "fields": ChatFieldSection,
    "questions": ChatQuestionSection,
    "options": ChatOptionSection,
    "videos": ChatVideoSection,
    "images": ChatImageSection,
    "problem_statements": ChatProblemStatementSection,
    "objectives": ChatObjectiveSection,
}


# =============================================================================
# Chat Start Context (kept from original)
# =============================================================================


async def get_chat_start_context(
    conn: asyncpg.Connection,
    profile_id: UUID,
    chat_entry_id: UUID,
    department_id: UUID,
    draft_id: UUID | None = None,
) -> GetChatStartWebsocketResponse:
    """Thin websocket fetch for chat start flow."""
    params = GetTrainingStartContextSqlParams(
        p_profile_id=profile_id,
        p_chat_entry_id=chat_entry_id,
        p_department_id=department_id,
        p_draft_id=draft_id,
    )

    row = cast(
        GetTrainingStartContextSqlRow,
        await execute_sql_typed(conn, SQL_PATH_START_CONTEXT, params=params),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chat start context not found")

    return GetChatStartWebsocketResponse(
        entries=ChatStartWebsocketEntries(
            chat_entry_id=chat_entry_id,
            department_id=department_id,
        ),
        resources=ChatStartWebsocketResources(
            simulation_id=row.simulation_id,
            scenario_id=row.scenario_id,
            problem_statement=row.problem_statement,
            objectives=row.objectives,
            persona=row.persona,
            video_ids=list(row.video_ids) if row.video_ids else None,
            image_ids=list(row.image_ids) if row.image_ids else None,
            has_problem_statement=row.has_problem_statement or False,
            has_persona=row.has_persona or False,
            agent_id=row.agent_id,
            agent_exists=row.agent_exists or False,
            agent_name=row.agent_name,
            agent_is_active=row.agent_is_active or False,
            model_id=row.model_id,
            model_name=row.model_name,
            provider_id=row.provider_id,
            provider_name=row.provider_name,
            has_api_key=row.has_api_key or False,
            requests_per_day=row.requests_per_day,
            runs_today=int(row.runs_today or 0),
            simulation_exists=row.simulation_exists or False,
            simulation_is_active=row.simulation_is_active or False,
            profile_has_access=row.profile_has_access or False,
            valid_entry_types=list(row.valid_entry_types or []),
        ),
    )


# =============================================================================
# WebSocket Layer (stub — kept as-is for now)
# =============================================================================


async def get_chat_websocket(*args, **kwargs):
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_chat_websocket needs to be rewritten with infra functions"
    )


# =============================================================================
# Client/BFF Layer — composable infra architecture
# =============================================================================


async def get_chat_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    chat_entry_id: UUID | None = None,
    attempt_id: UUID | None = None,
    draft_id: UUID | None = None,
    group_id: UUID,
    bypass_cache: bool = False,
) -> GetChatResponse:
    """HTTP-facing chat bundle response — composable infra pattern.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_chat_context(group_id, draft_id) → hydrated resources from draft
      3. score_tools(tool_graph, CHAT_BUNDLE_RESOURCES) → per-resource tool picks
      4. Pure Python: show flags, response assembly
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

    # ── Step 2: Chat artifact context (draft-only) ────────────────────────

    ctx = await resolve_chat_context(
        conn,
        redis,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=common.profile.department_ids,
        bypass_cache=bypass_cache,
    )

    # ── Step 3: Tool scoring ──────────────────────────────────────────────

    scores = score_tools(common.tool_graph, CHAT_BUNDLE_RESOURCES)

    # ── Step 4: Pure Python — section assembly ────────────────────────────

    def _section(resource_key: str) -> BaseChatSection:
        cls = _SECTION_CLASSES[resource_key]
        pair = ctx.resources.get(resource_key)
        if not pair:
            return cls(show=True, required=False)
        return cls(
            show=True,
            required=False,
            show_ai_generate=scores.best.get(resource_key) is not None,
            current=pair.selected or None,
            resources=pair.suggestions or None,
        )

    return GetChatResponse(
        chat_entry_id=chat_entry_id or group_id,
        attempt_id=attempt_id,
        group_id=group_id,
        draft_version=ctx.draft_version,
        names=_section("names"),
        descriptions=_section("descriptions"),
        flags=_section("flags"),
        departments=_section("departments"),
        personas=_section("personas"),
        documents=_section("documents"),
        parameter_fields=_section("parameter_fields"),
        scenarios=_section("scenarios"),
        fields=_section("fields"),
        questions=_section("questions"),
        options=_section("options"),
        videos=_section("videos"),
        images=_section("images"),
        problem_statements=_section("problem_statements"),
        objectives=_section("objectives"),
    )


# =============================================================================
# Route Handler
# =============================================================================


@router.post("/get", response_model=GetChatResponse)
async def chat_get(
    request: GetChatRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetChatResponse:
    """Get hydrated resources for chat bundle customization."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        redis = get_redis_client()

        return await get_chat_client(
            conn,
            redis,
            profile_id=cast(UUID, profile_id),
            chat_entry_id=request.chat_entry_id,
            attempt_id=request.attempt_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="chat_get",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
