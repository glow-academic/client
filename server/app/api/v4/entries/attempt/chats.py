"""Attempt chats entries (migrated from views/attempt/chats)."""

from uuid import UUID

import asyncpg

from app.api.v4.entries.attempt.types import ChatViewItem, GradeItem
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached


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
    from app.api.v4.entries.chat.training_config import get_training_config_internal

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
        config_map = await get_training_config_internal(
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
