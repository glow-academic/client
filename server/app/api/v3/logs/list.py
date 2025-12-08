"""Logs list endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class LogsListRequest(BaseModel):
    profileId: str


class LogItem(BaseModel):
    """Log item with new simplified structure."""

    log_id: str
    level: str
    logger_name: str
    message: str
    profile_id: str
    extra: dict[str, Any] | None
    created_at: str
    actor_name: str


class LogsListResponse(BaseModel):
    logs: list[LogItem]


router = APIRouter()


@router.post("/list", response_model=LogsListResponse)
async def list_logs(
    request: LogsListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LogsListResponse:
    """Get list of logs with actor information and all JSONB fields."""
    tags = ["logs"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return LogsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/logs/get_logs_list.sql")
        sql_params = ()  # No parameters for this query
        rows = await conn.fetch(sql_query)

        log_items: list[LogItem] = []
        for row in rows:
            # Parse extra JSONB if present
            extra = row.get("extra")
            if isinstance(extra, str):
                import json

                try:
                    extra = json.loads(extra)
                except Exception:
                    extra = None

            log_items.append(
                LogItem(
                    log_id=row["log_id"],
                    level=row["level"],
                    logger_name=row["logger_name"],
                    message=row["message"],
                    profile_id=row["profile_id"],
                    extra=extra if isinstance(extra, dict) else None,
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                    actor_name=row["actor_name"],
                )
            )

        response_data = LogsListResponse(logs=log_items)

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_logs_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
