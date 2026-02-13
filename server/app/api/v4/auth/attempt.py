"""POST /auth/attempt — lightweight attempt control state for layout header."""

from __future__ import annotations

import re
import time
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.access import get_access_internal
from app.api.v4.auth.types import GetAuthAttemptApiResponse
from app.api.v4.views.attempt.chats.get import get_attempt_chats_internal
from app.api.v4.views.attempt.list.get import get_attempt_list_internal
from app.api.v4.views.attempt.messages.get import get_attempt_messages_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import GetProfileContextApiRequest

router = APIRouter()

_ATTEMPT_PATH_RE = re.compile(r"/(?:home|practice)/([0-9a-f-]{36})")


@router.post(
    "/attempt",
    response_model=GetAuthAttemptApiResponse,
    dependencies=[
        audit_activity("auth.attempt", "{{ actor.name }} checked attempt controls")
    ],
)
async def get_auth_attempt(
    request: GetProfileContextApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthAttemptApiResponse:
    """Lightweight attempt control state for layout header SSR."""
    try:
        # 1. Profile ID
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        pathname = http_request.headers.get("X-Pathname", "")

        # 2. Parse attempt_id from pathname
        m = _ATTEMPT_PATH_RE.search(pathname)
        if not m:
            return GetAuthAttemptApiResponse()

        attempt_id_str = m.group(1)
        try:
            attempt_uuid = UUID(attempt_id_str)
        except ValueError:
            return GetAuthAttemptApiResponse()

        # 3. Auth (shared cache with /auth/profile)
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        pass1_start = time.time()
        await get_access_internal(conn, profile_id, bypass_cache)
        pass1_time = (time.time() - pass1_start) * 1000

        # 4. Resolve profiles_id for ownership check
        profiles_id: UUID | None = None
        if profile_id:
            profiles_id = await conn.fetchval(
                """
                SELECT profiles_id FROM profile_profiles_junction
                WHERE profile_id = $1 AND active = true
                LIMIT 1
                """,
                UUID(profile_id) if isinstance(profile_id, str) else profile_id,
            )

        # 5. Fetch attempt list + chats in parallel
        pool = get_pool()
        if not pool:
            return GetAuthAttemptApiResponse()

        import asyncio

        async def fetch_attempt() -> list:
            async with pool.acquire() as c:
                return await get_attempt_list_internal(
                    conn=c,
                    attempt_ids=[attempt_uuid],
                    bypass_cache=bypass_cache,
                )

        async def fetch_chats() -> list:
            async with pool.acquire() as c:
                return await get_attempt_chats_internal(
                    conn=c,
                    attempt_id=attempt_uuid,
                    bypass_cache=bypass_cache,
                )

        attempt_result, chats_result = await asyncio.gather(
            fetch_attempt(), fetch_chats()
        )

        if not attempt_result:
            return GetAuthAttemptApiResponse()

        attempt_item = attempt_result[0]

        # 6. Ownership check
        is_own = (
            profiles_id is not None
            and attempt_item.profile_id is not None
            and attempt_item.profile_id == profiles_id
        )
        if not is_own:
            return GetAuthAttemptApiResponse()

        # 7. Compute control state from chats
        chats = chats_result or []
        all_chats_completed = all(c.completed for c in chats) if chats else False

        # Time limit / is_active
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
            return GetAuthAttemptApiResponse()

        # 8. Current chat (first incomplete, or last if all complete)
        current_chat = None
        for chat in chats:
            if not chat.completed:
                current_chat = chat
                break
        if current_chat is None and chats:
            current_chat = chats[-1]

        current_chat_id = str(current_chat.chat_id) if current_chat else None

        # 9. has_messages — fetch messages and check current chat
        has_messages = False
        if current_chat_id:
            async with pool.acquire() as c:
                messages = await get_attempt_messages_internal(
                    conn=c,
                    attempt_id=attempt_uuid,
                    bypass_cache=bypass_cache,
                )
            has_messages = any(str(msg.chat_id) == current_chat_id for msg in messages)

        pass2_time = (time.time() - pass1_start) * 1000 - pass1_time

        response.headers["X-Two-Pass"] = "1"
        response.headers["X-Pass1-Time"] = f"{pass1_time:.1f}"
        response.headers["X-Pass2-Time"] = f"{pass2_time:.1f}"

        return GetAuthAttemptApiResponse(
            show_controls=True,
            attempt_id=str(attempt_uuid),
            current_chat_id=current_chat_id,
            simulation_id=str(attempt_item.simulation_id)
            if attempt_item.simulation_id
            else None,
            has_messages=has_messages,
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_attempt",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
