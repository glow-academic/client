"""Chat bundle artifact endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_chat_context — draft-only → hydrated resources
  3. score_tools — tool graph + artifact resources → per-resource tool picks
  4. Pure Python — show/required flags, response assembly
"""

from __future__ import annotations

from typing import cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Request
from redis.asyncio import Redis

from app.infra.chat_context import resolve_chat_context
from app.infra.chat_permissions import CHAT_BUNDLE_RESOURCES
from app.infra.common_context import resolve_common_context
from app.infra.globals import get_pool, get_redis_client
from app.infra.tool_graph import score_tools
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
    ChatVideoSection,
    GetChatRequest,
    GetChatResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

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
# Client/BFF Layer — composable infra architecture
# =============================================================================


async def get_chat_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    chat_entry_id: UUID | None = None,
    attempt_id: UUID | None = None,
    draft_id: UUID | None = None,
    group_id: UUID,
    # Search filters
    description_search: str | None = None,
    persona_search: str | None = None,
    document_search: str | None = None,
    problem_statement_search: str | None = None,
    image_search: str | None = None,
    video_search: str | None = None,
    question_search: str | None = None,
    option_search: str | None = None,
    # Show-selected toggles
    persona_show_selected: bool | None = None,
    document_show_selected: bool | None = None,
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
        pool,
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
        pool,
        redis,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=common.profile.department_ids,
        description_search=description_search,
        persona_search=persona_search,
        document_search=document_search,
        problem_statement_search=problem_statement_search,
        image_search=image_search,
        video_search=video_search,
        question_search=question_search,
        option_search=option_search,
        persona_show_selected=persona_show_selected,
        document_show_selected=document_show_selected,
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
        pool = get_pool()
        redis = get_redis_client()

        return await get_chat_client(
            pool,
            redis,
            profile_id=cast(UUID, profile_id),
            chat_entry_id=request.chat_entry_id,
            attempt_id=request.attempt_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            description_search=request.description_search,
            persona_search=request.persona_search,
            document_search=request.document_search,
            problem_statement_search=request.problem_statement_search,
            image_search=request.image_search,
            video_search=request.video_search,
            question_search=request.question_search,
            option_search=request.option_search,
            persona_show_selected=request.persona_show_selected,
            document_show_selected=request.document_show_selected,
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
