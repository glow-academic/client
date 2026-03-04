"""parameters/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetParametersV4Item,
    SearchConditionalParametersSqlParams,
    SearchConditionalParametersSqlRow,
    SearchParametersSqlParams,
    SearchParametersSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/parameters/search_parameters_complete.sql"

CONDITIONAL_SQL_PATH = (
    "app/sql/queries/resources/parameters/search_conditional_parameters_complete.sql"
)

async def search_parameters_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    persona_parameter: bool | None = None,
    document_parameter: bool | None = None,
    scenario_parameter: bool | None = None,
    video_parameter: bool | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    field_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    document: bool = False,
    parameter: bool = False,
    persona: bool = False,
    scenario: bool = False,
) -> list[QGetParametersV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "parameters"]
    cache_key_val = cache_key(
        "/api/v5/resources/parameters/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "persona_parameter": persona_parameter,
            "document_parameter": document_parameter,
            "scenario_parameter": scenario_parameter,
            "video_parameter": video_parameter,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "field_ids": sorted(str(i) for i in (field_ids or [])),
            "document": document,
            "parameter": parameter,
            "persona": persona,
            "scenario": scenario,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetParametersV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchParametersSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        p_persona_parameter=persona_parameter,
        p_document_parameter=document_parameter,
        p_scenario_parameter=scenario_parameter,
        p_video_parameter=video_parameter,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        field_ids=field_ids or [],
        document=document,
        parameter=parameter,
        persona=persona,
        scenario=scenario,
    )
    result = cast(
        SearchParametersSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetParametersV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

async def search_conditional_parameters_internal(
    conn: asyncpg.Connection,
    parameter_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetParametersV4Item]:
    """Fetch all conditional parameters transitively from the given parameter IDs.

    Uses a recursive CTE to find all conditional parameters in the chain.
    For example, if Persona Type -> Temperament -> Intensity, this returns
    both Temperament and Intensity when given Persona Type.
    """
    if not parameter_ids:
        return []

    tags = ["resources", "parameters", "conditional"]
    cache_key_val = cache_key(
        "/api/v5/resources/parameters/search_conditional",
        {
            "parameter_ids": [str(id) for id in parameter_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetParametersV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchConditionalParametersSqlParams(
        parameter_ids=parameter_ids,
    )
    result = cast(
        SearchConditionalParametersSqlRow,
        await execute_sql_typed(conn, CONDITIONAL_SQL_PATH, params=params),
    )

    items: list[QGetParametersV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items
