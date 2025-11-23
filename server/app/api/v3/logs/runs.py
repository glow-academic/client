"""Logs runs endpoint - POST /logs/runs"""

import json
from datetime import datetime
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

router = APIRouter()


# Inline filter schemas
class LogsRunsFilters(BaseModel):
    """Logs runs filter request schema."""

    profileId: str
    startDate: str | None = None
    endDate: str | None = None
    levels: list[str] | None = None
    loggerNames: list[str] | None = None
    actorNames: list[str] | None = None
    search: str | None = None
    sortBy: str | None = None
    sortOrder: str | None = None
    page: int = 0
    pageSize: int = 10


# Inline schemas
class LogItem(BaseModel):
    """Log item."""

    id: str
    created_at: str
    logger_name: str
    level: str
    actor_name: str
    profile_id: str | None = None
    message: str | None = None
    extra: dict[str, Any] | None = None


class FilterOption(BaseModel):
    """Filter option with count."""

    value: str
    label: str
    count: int


class LogsRunsResponse(BaseModel):
    """Response for logs runs table."""

    data: list[LogItem]
    totalCount: int
    page: int
    pageSize: int
    totalPages: int
    levelOptions: list[FilterOption] = []
    loggerOptions: list[FilterOption] = []
    actorOptions: list[FilterOption] = []


def _parse_json_strings_recursive(obj: Any) -> Any:
    """Recursively parse JSON strings in nested structures."""
    if isinstance(obj, str):
        try:
            return json.loads(obj)
        except (json.JSONDecodeError, ValueError):
            return obj
    elif isinstance(obj, dict):
        return {k: _parse_json_strings_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_parse_json_strings_recursive(item) for item in obj]
    else:
        return obj


@router.post("/runs", response_model=LogsRunsResponse)
async def get_logs_runs(
    filters: LogsRunsFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LogsRunsResponse:
    """Get paginated, filtered, searched logs for table."""
    tags = ["logs"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return LogsRunsResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Build parameters for SQL query
        start_dt = None
        if filters.startDate:
            start_dt = datetime.fromisoformat(filters.startDate.replace("Z", "+00:00"))

        end_dt = None
        if filters.endDate:
            end_dt = datetime.fromisoformat(filters.endDate.replace("Z", "+00:00"))

        levels = filters.levels or None
        logger_names = filters.loggerNames or None
        actor_names = filters.actorNames or None
        search = filters.search or None

        # Build ORDER BY clause
        sort_by = filters.sortBy or "createdAt"
        sort_order = (filters.sortOrder or "desc").upper()

        # Map sortBy to actual column names
        sort_column_map = {
            "createdAt": "created_at",
            "level": "level",
            "loggerName": "logger_name",
            "actorName": "actor_name",
        }

        sort_column = sort_column_map.get(sort_by, "created_at")
        # Add NULLS LAST to ensure NULL values are sorted to the end
        order_by_clause = f"ORDER BY {sort_column} {sort_order} NULLS LAST"
        # Also need ORDER BY in json_agg to preserve sort order
        json_agg_order_by = f"ORDER BY {sort_column} {sort_order} NULLS LAST"

        # Pagination parameters
        page = filters.page
        page_size = filters.pageSize
        offset = page * page_size
        limit_offset_clause = f"LIMIT {page_size} OFFSET {offset}"

        # Load SQL template
        sql_template = load_sql("sql/v3/logs/runs.sql")

        # Replace placeholders in SQL template
        sql_query = sql_template.replace("{ORDER_BY_CLAUSE}", order_by_clause)
        sql_query = sql_query.replace("{LIMIT_OFFSET_CLAUSE}", limit_offset_clause)
        sql_query = sql_query.replace("{JSON_AGG_ORDER_BY}", json_agg_order_by)

        sql_params = (
            start_dt,
            end_dt,
            levels,
            logger_names,
            search,
            actor_names,
        )

        # Execute query
        result = await conn.fetchval(sql_query, *sql_params)

        # Handle empty results gracefully
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)
        if not isinstance(parsed_result, dict):
            parsed_result = {}

        # Extract data array and pagination metadata
        bundle_data = parsed_result.get("data", []) if parsed_result else []
        total_count = parsed_result.get("totalCount", 0) if parsed_result else 0
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0

        # Parse log items
        log_items = []
        for log_data in bundle_data:
            extra = log_data.get("extra")
            if isinstance(extra, str):
                try:
                    extra = json.loads(extra)
                except Exception:
                    extra = None

            log_items.append(
                LogItem(
                    id=log_data["id"],
                    created_at=log_data["created_at"],
                    logger_name=log_data["logger_name"],
                    level=log_data["level"],
                    actor_name=log_data["actor_name"],
                    profile_id=log_data.get("profile_id"),
                    message=log_data.get("message"),
                    extra=extra if isinstance(extra, dict) else None,
                )
            )

        # Parse filter options
        level_options_data = parsed_result.get("levelOptions", [])
        if isinstance(level_options_data, str):
            level_options_data = json.loads(level_options_data)
        level_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (level_options_data if isinstance(level_options_data, list) else [])
        ]

        logger_options_data = parsed_result.get("loggerOptions", [])
        if isinstance(logger_options_data, str):
            logger_options_data = json.loads(logger_options_data)
        logger_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (logger_options_data if isinstance(logger_options_data, list) else [])
        ]

        actor_options_data = parsed_result.get("actorOptions", [])
        if isinstance(actor_options_data, str):
            actor_options_data = json.loads(actor_options_data)
        actor_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (actor_options_data if isinstance(actor_options_data, list) else [])
        ]

        # Build response
        response_data = LogsRunsResponse(
            data=log_items,
            totalCount=total_count,
            page=page,
            pageSize=page_size,
            totalPages=total_pages,
            levelOptions=level_options,
            loggerOptions=logger_options,
            actorOptions=actor_options,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,  # Cache for 1 minute
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
            route_path=request.url.path,
            operation="get_logs_runs",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

