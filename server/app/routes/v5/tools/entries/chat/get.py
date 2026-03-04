"""chat/get — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.chat.types import GetChatResponse
from app.sql.types import (
    GetChatEntriesSqlParams,
    GetChatEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

MV_NAME = "chat_mv"

CHAT_ENTRIES_SQL_PATH = "app/sql/queries/entries/chat/get_chat_entries_complete.sql"


async def get_chats(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetChatResponse]:
    """Get chat entries by IDs from chat_mv."""
    if not ids:
        return []

    rows = await conn.fetch(
        f"""
        SELECT chat_entry_id, parent_id, scenario_id,
               department_ids, document_ids, parameter_field_ids,
               question_ids, option_ids, video_ids, image_ids,
               problem_statement_ids, objective_ids, flag_ids,
               name_ids, description_ids, persona_ids,
               rubric_ids, standard_ids, standard_group_ids,
               video_enabled, problem_statement_enabled,
               objectives_enabled, images_enabled, questions_enabled,
               position, time_limit, negative_time
        FROM {MV_NAME}
        WHERE chat_entry_id = ANY($1)
        """,
        ids,
    )

    return [
        GetChatResponse(
            id=r["chat_entry_id"],
            parent_id=r["parent_id"],
            scenario_id=r["scenario_id"],
            department_ids=r["department_ids"] or [],
            document_ids=r["document_ids"] or [],
            parameter_field_ids=r["parameter_field_ids"] or [],
            question_ids=r["question_ids"] or [],
            option_ids=r["option_ids"] or [],
            video_ids=r["video_ids"] or [],
            image_ids=r["image_ids"] or [],
            problem_statement_ids=r["problem_statement_ids"] or [],
            objective_ids=r["objective_ids"] or [],
            flag_ids=r["flag_ids"] or [],
            name_ids=r["name_ids"] or [],
            description_ids=r["description_ids"] or [],
            persona_ids=r["persona_ids"] or [],
            rubric_ids=r["rubric_ids"] or [],
            standard_ids=r["standard_ids"] or [],
            standard_group_ids=r["standard_group_ids"] or [],
            video_enabled=r["video_enabled"],
            problem_statement_enabled=r["problem_statement_enabled"],
            objectives_enabled=r["objectives_enabled"],
            images_enabled=r["images_enabled"],
            questions_enabled=r["questions_enabled"],
            position=r["position"],
            time_limit=r["time_limit"],
            negative_time=r["negative_time"],
        )
        for r in rows
    ]


async def get_chat_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch chat entries by IDs from chat_mv."""
    if not ids:
        return []

    tags = ["entries", "chat"]
    cache_key_val = cache_key(
        "/api/v5/entries/chat/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetChatEntriesSqlParams(ids=ids)
    result = cast(
        GetChatEntriesSqlRow,
        await execute_sql_typed(conn, CHAT_ENTRIES_SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items
