"""Attempt entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetAttemptEntriesApiRequest,
    GetAttemptEntriesApiResponse,
    GetAttemptEntriesSqlParams,
    GetAttemptEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt/get_attempt_entries_complete.sql"
TRAINING_CONFIG_SQL = (
    "app/sql/v4/queries/views/chat/training_config/get_training_config_complete.sql"
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Types (inlined from types.py)
# ---------------------------------------------------------------------------


class GradeItem(BaseModel):
    """Grade composite type."""

    score: float | None = None
    passed: bool | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None


class TrainingConfig(BaseModel):
    """Training department config flags + resource ID arrays."""

    chat_resolved_id: UUID
    copy_paste_allowed: bool = True
    text_enabled: bool = True
    audio_enabled: bool = True
    hints_enabled: bool = True
    show_images: bool = True
    show_objectives: bool = True
    show_problem_statement: bool = True
    time_limit_seconds: int = 0
    negative: bool = False
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    problem_statement_id: UUID | None = None
    persona_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class ChatViewItem(BaseModel):
    """Single chat from attempt chats."""

    chat_id: UUID
    attempt_id: UUID | None = None
    group_id: UUID | None = None
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    problem_statement_id: UUID | None = None
    copy_paste_allowed: bool | None = None
    text_enabled: bool | None = None
    audio_enabled: bool | None = None
    hints_enabled: bool | None = None
    show_images: bool | None = None
    show_objectives: bool | None = None
    show_problem_statement: bool | None = None
    time_limit_seconds: int | None = None
    negative: bool | None = None
    created_at: datetime | None = None
    completed: bool = False
    grade: GradeItem | None = None
    persona_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class AttemptMessageViewItem(BaseModel):
    """Single message from attempt messages."""

    message_id: UUID
    chat_id: UUID | None = None
    attempt_id: UUID | None = None
    type: str | None = None
    created_at: datetime | None = None
    completed: bool = False
    runs_id: UUID | None = None
    history_content: str | None = None
    audio_id: UUID | None = None


# ---------------------------------------------------------------------------
# Training config helper
# ---------------------------------------------------------------------------


async def _fetch_training_config(
    conn: asyncpg.Connection,
    chat_resolved_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, TrainingConfig]:
    """Fetch training config for a batch of chat_resolved_ids."""
    if not chat_resolved_ids:
        return {}

    from app.sql.types import GetTrainingConfigSqlParams

    tc_cache_key = cache_key(
        "entries/chat/training_config/get",
        {"ids": sorted(str(i) for i in chat_resolved_ids)},
    )

    if not bypass_cache:
        cached_val = await get_cached(tc_cache_key)
        if cached_val:
            configs: dict[UUID, TrainingConfig] = {}
            for key, val in cached_val.items():
                configs[UUID(key)] = TrainingConfig.model_validate(val)
            return configs

    params = GetTrainingConfigSqlParams(chat_resolved_ids=chat_resolved_ids)
    result = await execute_sql_typed(conn, TRAINING_CONFIG_SQL, params=params)

    configs = {}
    if result and result.items:
        for item in result.items:
            configs[item.chat_resolved_id] = TrainingConfig(
                chat_resolved_id=item.chat_resolved_id,
                copy_paste_allowed=item.copy_paste_allowed
                if item.copy_paste_allowed is not None
                else True,
                text_enabled=item.text_enabled
                if item.text_enabled is not None
                else True,
                audio_enabled=item.audio_enabled
                if item.audio_enabled is not None
                else True,
                hints_enabled=item.hints_enabled
                if item.hints_enabled is not None
                else True,
                show_images=item.show_images if item.show_images is not None else True,
                show_objectives=item.show_objectives
                if item.show_objectives is not None
                else True,
                show_problem_statement=item.show_problem_statement
                if item.show_problem_statement is not None
                else True,
                time_limit_seconds=item.time_limit_seconds or 0,
                negative=item.negative or False,
                scenario_id=item.scenario_id,
                rubric_id=item.rubric_id,
                problem_statement_id=item.problem_statement_id,
                persona_ids=list(item.persona_ids) if item.persona_ids else None,
                objective_ids=list(item.objective_ids) if item.objective_ids else None,
                question_ids=list(item.question_ids) if item.question_ids else None,
                option_ids=list(item.option_ids) if item.option_ids else None,
                image_ids=list(item.image_ids) if item.image_ids else None,
                video_ids=list(item.video_ids) if item.video_ids else None,
                document_ids=list(item.document_ids) if item.document_ids else None,
                standard_group_ids=list(item.standard_group_ids)
                if item.standard_group_ids
                else None,
                standard_ids=list(item.standard_ids) if item.standard_ids else None,
            )

    await set_cached(
        tc_cache_key,
        {str(k): v.model_dump(mode="json") for k, v in configs.items()},
        ttl=300,
        tags=["entries", "chat", "training_config"],
    )

    return configs


# ---------------------------------------------------------------------------
# Internal: get attempt entries
# ---------------------------------------------------------------------------


async def get_attempt_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt"]
    cache_key_val = cache_key(
        "/api/v4/entries/attempt/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items


# ---------------------------------------------------------------------------
# Internal: get attempt chats
# ---------------------------------------------------------------------------

CHATS_SQL_PATH = None  # Uses get_chats_internal, no direct SQL


async def get_attempt_chats_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID | None = None,
    attempt_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[ChatViewItem]:
    """Internal function for fetching lean chat data.

    Uses attempt_chat_mv for base data + training config service for config flags
    and resource ID arrays.
    """
    from app.api.v4.entries.chat.get import get_chats_internal

    ids = attempt_ids or ([attempt_id] if attempt_id else [])

    cache_key_val = cache_key(
        "entries/attempt/chats/get",
        {"attempt_ids": [str(a) for a in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ChatViewItem.model_validate(item) for item in cached["items"]]

    # Pass 1: Get base chat data from attempt_chat_mv
    all_items = []
    for aid in ids:
        chats_result = await get_chats_internal(
            conn=conn,
            attempt_id=aid,
            is_archived=False,
            sort_by="created_at",
            sort_order="asc",
            bypass_cache=bypass_cache,
        )
        all_items.extend(chats_result.items)

    # Pass 2: Get training config for all unique chat_resolved_ids
    cr_ids = list(
        {item.chat_resolved_id for item in all_items if item.chat_resolved_id}
    )
    config_map = {}
    if cr_ids:
        config_map = await _fetch_training_config(
            conn=conn,
            chat_resolved_ids=cr_ids,
            bypass_cache=bypass_cache,
        )

    # Compose ChatViewItem from both sources
    items: list[ChatViewItem] = []
    for chat in all_items:
        config = (
            config_map.get(chat.chat_resolved_id) if chat.chat_resolved_id else None
        )

        grade = None
        if chat.grade_score is not None or chat.grade_passed is not None:
            grade = GradeItem(
                score=chat.grade_score,
                passed=chat.grade_passed,
                time_taken=chat.grade_time_taken,
                total_points=chat.grade_total_points,
                pass_points=chat.grade_pass_points,
            )

        rubric_id = chat.rubric_id or (config.rubric_id if config else None)

        items.append(
            ChatViewItem(
                chat_id=chat.chat_id,
                attempt_id=chat.attempt_id,
                group_id=chat.group_id,
                scenario_id=chat.scenario_id
                or (config.scenario_id if config else None),
                rubric_id=rubric_id,
                problem_statement_id=config.problem_statement_id if config else None,
                copy_paste_allowed=config.copy_paste_allowed if config else True,
                text_enabled=config.text_enabled if config else True,
                audio_enabled=config.audio_enabled if config else True,
                hints_enabled=config.hints_enabled if config else True,
                show_images=config.show_images if config else True,
                show_objectives=config.show_objectives if config else True,
                show_problem_statement=config.show_problem_statement
                if config
                else True,
                time_limit_seconds=config.time_limit_seconds if config else 0,
                negative=config.negative if config else False,
                created_at=chat.chat_created_at,
                completed=chat.completed,
                grade=grade,
                persona_ids=config.persona_ids if config else None,
                objective_ids=config.objective_ids if config else None,
                question_ids=config.question_ids if config else None,
                option_ids=config.option_ids if config else None,
                image_ids=config.image_ids if config else None,
                video_ids=config.video_ids if config else None,
                document_ids=config.document_ids if config else None,
                standard_group_ids=config.standard_group_ids if config else None,
                standard_ids=config.standard_ids if config else None,
            )
        )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt", "chats"],
    )

    return items


# ---------------------------------------------------------------------------
# Internal: get attempt messages
# ---------------------------------------------------------------------------

MESSAGES_SQL_PATH = (
    "app/sql/v4/queries/views/attempt/messages/get_attempt_messages_view_complete.sql"
)


async def get_attempt_messages_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    bypass_cache: bool = False,
) -> list[AttemptMessageViewItem]:
    """Internal function for fetching lean message data."""
    from app.sql.types import GetAttemptMessagesViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt/messages/get",
        {"attempt_id": str(attempt_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                AttemptMessageViewItem.model_validate(item) for item in cached["items"]
            ]

    params = GetAttemptMessagesViewSqlParams(attempt_id_filter=attempt_id)
    result = await execute_sql_typed(conn, MESSAGES_SQL_PATH, params=params)

    items: list[AttemptMessageViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                AttemptMessageViewItem(
                    message_id=item.message_id,
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    type=item.type,
                    created_at=item.created_at,
                    completed=item.completed or False,
                    runs_id=item.runs_id,
                    history_content=item.history_content,
                    audio_id=item.audio_id,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt", "messages"],
    )

    return items


# ---------------------------------------------------------------------------
# Router handler
# ---------------------------------------------------------------------------


@router.post(
    "/attempt/get",
    response_model=GetAttemptEntriesApiResponse,
)
async def get_attempt_entries(
    request: GetAttemptEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptEntriesApiResponse:
    """Get attempt entries by IDs."""
    tags = ["entries", "attempt"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
