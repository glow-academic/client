"""parameters/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetParametersSqlParams,
    GetParametersSqlRow,
    QGetParametersV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/parameters/get_parameters_complete.sql"

async def get_parameters_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
    persona_parameter: bool | None = None,
    document_parameter: bool | None = None,
    scenario_parameter: bool | None = None,
    video_parameter: bool | None = None,
) -> list[QGetParametersV4Item]:
    """Internal function to fetch parameters by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "parameters"]
    cache_key_val = cache_key(
        "/api/v5/resources/parameters/get",
        {
            "ids": [str(id) for id in ids],
            "persona_parameter": persona_parameter,
            "document_parameter": document_parameter,
            "scenario_parameter": scenario_parameter,
            "video_parameter": video_parameter,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetParametersV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetParametersSqlParams(
        ids=ids,
        p_persona_parameter=persona_parameter,
        p_document_parameter=document_parameter,
        p_scenario_parameter=scenario_parameter,
        p_video_parameter=video_parameter,
    )
    result = cast(
        GetParametersSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetParametersV4Item] = result.items if result and result.items else []

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items
