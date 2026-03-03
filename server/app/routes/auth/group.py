"""Resolve group_id endpoint — unified resolution from attempt, test, draft, or fresh."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from app.routes.auth.types import ResolveGroupApiRequest, ResolveGroupApiResponse
from app.routes.v5.api.entries.attempt.get import (
    get_attempt_chats_internal,
    get_attempt_messages_internal,
)
from app.routes.v5.api.entries.attempt.search import get_attempt_list_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_pool
from app.sql.types import GetAttemptListViewSqlRow

router = APIRouter()

# Mapping from artifact_type to its drafts_entry table name
_DRAFT_TABLE_MAP: dict[str, str] = {
    "agent": "agent_drafts_entry",
    "cohort": "cohort_drafts_entry",
    "department": "department_drafts_entry",
    "document": "document_drafts_entry",
    "eval": "eval_drafts_entry",
    "field": "field_drafts_entry",
    "model": "model_drafts_entry",
    "parameter": "parameter_drafts_entry",
    "persona": "persona_drafts_entry",
    "profile": "profile_drafts_entry",
    "provider": "provider_drafts_entry",
    "rubric": "rubric_drafts_entry",
    "scenario": "scenario_drafts_entry",
    "setting": "setting_drafts_entry",
    "simulation": "simulation_drafts_entry",
    "tool": "tool_drafts_entry",
    "chat": "chat_drafts_entry",
    "auth": "auth_drafts_entry",
}

# All known draft entry tables (for UNION lookup when artifact_type unknown)
_ALL_DRAFT_TABLES = list(_DRAFT_TABLE_MAP.values())


async def _resolve_attempt_group(
    pool: object,
    attempt_uuid: UUID,
    profile_id: str | None,
    bypass_cache: bool,
) -> ResolveGroupApiResponse | None:
    """Attempt resolution: ownership check → chat state → group_id from current chat.

    Returns a full response if the attempt is active with controls, or None to fall through.
    """
    # Resolve profiles_id for ownership check
    profiles_id: UUID | None = None
    if profile_id:
        async with pool.acquire() as conn:  # type: ignore[union-attr]
            profiles_id = await conn.fetchval(
                """
                SELECT profiles_id FROM profile_profiles_junction
                WHERE profile_id = $1 AND active = true
                LIMIT 1
                """,
                UUID(profile_id) if isinstance(profile_id, str) else profile_id,
            )

    # Fetch attempt list + chats in parallel
    async def fetch_attempt() -> GetAttemptListViewSqlRow:  # type: ignore[return]
        async with pool.acquire() as c:  # type: ignore[union-attr]
            return await get_attempt_list_internal(
                conn=c,
                attempt_ids=[attempt_uuid],
                bypass_cache=bypass_cache,
            )

    async def fetch_chats() -> list:
        async with pool.acquire() as c:  # type: ignore[union-attr]
            return await get_attempt_chats_internal(
                conn=c,
                attempt_id=attempt_uuid,
                bypass_cache=bypass_cache,
            )

    attempt_result, chats_result = await asyncio.gather(fetch_attempt(), fetch_chats())

    if not attempt_result or not attempt_result.items:
        return None

    attempt_item = attempt_result.items[0]

    # Ownership check
    is_own = (
        profiles_id is not None
        and attempt_item.profile_id is not None
        and attempt_item.profile_id == profiles_id
    )
    if not is_own:
        return None

    # Compute control state
    chats = chats_result or []
    all_chats_completed = all(c.completed for c in chats) if chats else False

    time_limit_seconds = sum(c.time_limit_seconds or 0 for c in chats)
    elapsed_seconds = 0
    now = datetime.now(UTC)
    for chat in chats:
        if chat.grade and chat.grade.time_taken is not None:
            elapsed_seconds += chat.grade.time_taken
        elif chat.created_at and not chat.completed:
            try:
                created = (
                    chat.created_at
                    if hasattr(chat.created_at, "tzinfo")
                    else datetime.fromisoformat(str(chat.created_at))
                )
                if created.tzinfo is None:
                    created = created.replace(tzinfo=UTC)
                elapsed_seconds += max(int((now - created).total_seconds()), 0)
            except (ValueError, TypeError):
                pass

    is_active = True
    if time_limit_seconds > 0:
        infinite_mode = attempt_item.infinite_mode or False
        if infinite_mode:
            is_active = (time_limit_seconds - elapsed_seconds) > 0
        else:
            is_active = elapsed_seconds <= time_limit_seconds

    show_controls = is_own and is_active and not all_chats_completed

    if not show_controls:
        # Not active — fall through to fresh group
        return None

    # Current chat (first incomplete, or last if all complete)
    current_chat = None
    for chat in chats:
        if not chat.completed:
            current_chat = chat
            break
    if current_chat is None and chats:
        current_chat = chats[-1]

    current_chat_id = str(current_chat.chat_id) if current_chat else None

    # Resolve group_id from the current chat's attempt_chat_entry
    group_id = None
    if current_chat_id:
        async with pool.acquire() as c:  # type: ignore[union-attr]
            group_id = await c.fetchval(
                "SELECT group_id FROM attempt_chat_entry WHERE id = $1",
                UUID(current_chat_id),
            )

    if not group_id:
        return None

    # has_messages check
    has_messages = False
    if current_chat_id:
        async with pool.acquire() as c:  # type: ignore[union-attr]
            messages = await get_attempt_messages_internal(
                conn=c,
                attempt_id=attempt_uuid,
                bypass_cache=bypass_cache,
            )
        has_messages = any(str(msg.chat_id) == current_chat_id for msg in messages)

    return ResolveGroupApiResponse(
        group_id=str(group_id),
        show_controls=True,
        attempt_id=str(attempt_uuid),
        current_chat_id=current_chat_id,
        has_messages=has_messages,
    )


@router.post("/group", response_model=ResolveGroupApiResponse)
async def resolve_group(
    request: ResolveGroupApiRequest,
    http_request: Request,
) -> ResolveGroupApiResponse:
    """Resolve a group_id from attempt, test, draft, or create fresh."""
    try:
        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        # Priority 1: attempt_id → resolve from active attempt chat
        if request.attempt_id is not None:
            try:
                profile_id = http_request.state.profile_id
            except AttributeError:
                profile_id = None

            bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

            result = await _resolve_attempt_group(
                pool=pool,
                attempt_uuid=request.attempt_id,
                profile_id=profile_id,
                bypass_cache=bypass_cache,
            )
            if result is not None:
                return result
            # Fall through to fresh group if attempt not active

        # Priority 2: test_id → resolve from test_invocation_entry
        if request.test_id is not None:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, group_id FROM test_invocation_entry
                    WHERE test_id = $1 AND active = true
                    ORDER BY created_at DESC LIMIT 1
                    """,
                    request.test_id,
                )
            if row:
                invocation_id = row["id"]
                # Check if the invocation has any runs or groups
                async with pool.acquire() as conn:
                    has_runs_or_groups = await conn.fetchval(
                        """
                        SELECT EXISTS(
                            SELECT 1 FROM test_invocation_runs_entry
                            WHERE test_invocation_id = $1 AND active = true
                        ) OR EXISTS(
                            SELECT 1 FROM test_invocation_groups_entry
                            WHERE test_invocation_id = $1 AND active = true
                        )
                        """,
                        invocation_id,
                    )
                return ResolveGroupApiResponse(
                    group_id=str(row["group_id"]),
                    show_controls=True,
                    test_id=str(request.test_id),
                    current_invocation_id=str(invocation_id),
                    has_runs_or_groups=bool(has_runs_or_groups),
                )

        # Priority 3: draft_id → resolve from draft entry
        group_id = None
        if request.draft_id is not None:
            async with pool.acquire() as conn:
                if request.artifact_type and request.artifact_type in _DRAFT_TABLE_MAP:
                    table = _DRAFT_TABLE_MAP[request.artifact_type]
                    group_id = await conn.fetchval(
                        f"SELECT group_id FROM {table} WHERE id = $1",  # noqa: S608
                        request.draft_id,
                    )
                else:
                    parts = [
                        f"SELECT group_id FROM {t} WHERE id = $1"
                        for t in _ALL_DRAFT_TABLES
                    ]
                    union_query = " UNION ALL ".join(parts) + " LIMIT 1"
                    group_id = await conn.fetchval(union_query, request.draft_id)

        # Priority 4: Fallback — create a fresh group
        if not group_id:
            async with pool.acquire() as conn:
                group_id = await conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) "
                    "VALUES (NOW(), NOW()) RETURNING id"
                )

        return ResolveGroupApiResponse(group_id=str(group_id))

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="resolve_group",
            request=http_request,
        )
