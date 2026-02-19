"""Get endpoint for attempt chats view (lean — no composites)."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v4.views.attempt.chats.types import (
    ChatViewItem,
    GetChatsRequest,
    GetChatsResponse,
    GradeItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

router = APIRouter()

TRAINING_CONFIG_SQL = (
    "app/sql/v4/queries/views/chat/training_config/get_training_config_complete.sql"
)


class TrainingConfig(BaseModel):
    """Training department config flags + resource ID arrays."""

    training_department_id: UUID
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


async def _fetch_training_config(
    conn: asyncpg.Connection,
    training_department_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, TrainingConfig]:
    """Fetch training config for a batch of training_department_ids."""
    if not training_department_ids:
        return {}

    from app.sql.types import GetTrainingConfigSqlParams

    tc_cache_key = cache_key(
        "entries/chat/training_config/get",
        {"ids": sorted(str(i) for i in training_department_ids)},
    )

    if not bypass_cache:
        cached_val = await get_cached(tc_cache_key)
        if cached_val:
            configs: dict[UUID, TrainingConfig] = {}
            for key, val in cached_val.items():
                configs[UUID(key)] = TrainingConfig.model_validate(val)
            return configs

    params = GetTrainingConfigSqlParams(training_department_ids=training_department_ids)
    result = await execute_sql_typed(conn, TRAINING_CONFIG_SQL, params=params)

    configs = {}
    if result and result.items:
        for item in result.items:
            configs[item.training_department_id] = TrainingConfig(
                training_department_id=item.training_department_id,
                copy_paste_allowed=item.copy_paste_allowed if item.copy_paste_allowed is not None else True,
                text_enabled=item.text_enabled if item.text_enabled is not None else True,
                audio_enabled=item.audio_enabled if item.audio_enabled is not None else True,
                hints_enabled=item.hints_enabled if item.hints_enabled is not None else True,
                show_images=item.show_images if item.show_images is not None else True,
                show_objectives=item.show_objectives if item.show_objectives is not None else True,
                show_problem_statement=item.show_problem_statement if item.show_problem_statement is not None else True,
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
                standard_group_ids=list(item.standard_group_ids) if item.standard_group_ids else None,
                standard_ids=list(item.standard_ids) if item.standard_ids else None,
            )

    await set_cached(
        tc_cache_key,
        {str(k): v.model_dump(mode="json") for k, v in configs.items()},
        ttl=300,
        tags=["entries", "chat", "training_config"],
    )

    return configs


async def get_attempt_chats_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID | None = None,
    attempt_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[ChatViewItem]:
    """Internal function for fetching lean chat data.

    Uses attempt_chat_mv for base data + training config service for config flags
    and resource ID arrays. Composites (feedbacks, analyses, responses)
    fetched via simulation/* views.
    """
    from app.api.v4.entries.chat.get import get_chats_internal

    ids = attempt_ids or ([attempt_id] if attempt_id else [])

    cache_key_val = cache_key(
        "views/attempt/chats/get",
        {"attempt_ids": [str(a) for a in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ChatViewItem.model_validate(item) for item in cached["items"]]

    # Pass 1: Get base chat data from attempt_chat_mv (non-archived only for attempt detail)
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

    # Pass 2: Get training config for all unique training_department_ids
    td_ids = list(
        {
            item.training_department_id
            for item in all_items
            if item.training_department_id
        }
    )
    config_map = {}
    if td_ids:
        config_map = await _fetch_training_config(
            conn=conn,
            training_department_ids=td_ids,
            bypass_cache=bypass_cache,
        )

    # Compose ChatViewItem from both sources
    items: list[ChatViewItem] = []
    for chat in all_items:
        config = (
            config_map.get(chat.training_department_id)
            if chat.training_department_id
            else None
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

        # Rubric ID: prefer from grade, fall back to training config
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

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "attempt", "chats"],
    )

    return items


@router.post(
    "/get",
    response_model=GetChatsResponse,
    dependencies=[
        audit_activity(
            "views.attempt.chats.get",
            "{{ actor.name }} fetched attempt chat data",
        )
    ],
)
async def get_chats(
    request: GetChatsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetChatsResponse:
    """Get attempt chat data from the materialized view."""
    tags = ["views", "attempt", "chats"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        items = await get_attempt_chats_internal(
            conn=conn,
            attempt_id=request.attempt_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetChatsResponse(items=items)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_chats_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
