"""Log create endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


class CreateLogRequest(BaseModel):
    """Request to create a log entry."""

    level: str  # 'debug' | 'info' | 'warn' | 'error'
    logger_name: str  # Logger/component name
    message: str  # Log message
    profile_id: str  # Profile ID (may be "guest-profile-id", will be resolved)
    extra: dict[str, Any] | None = None  # Additional context data


class CreateLogResponse(BaseModel):
    """Response from creating a log entry."""

    success: bool
    log_id: int | None


router = APIRouter()


@router.post("/create", response_model=CreateLogResponse)
async def create_log(
    request: CreateLogRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateLogResponse:
    """Create a new log entry."""
    tags = ["logs"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Validate level
        if request.level.lower() not in ("debug", "info", "warn", "error"):
            raise HTTPException(
                status_code=400, detail=f"Invalid level: {request.level}"
            )

        # Prepare extra data
        extra_json = json.dumps(request.extra) if request.extra else None

        # Insert log entry (SQL will resolve guest-profile-id)
        sql_query = load_sql("sql/v3/logs/insert_log.sql")
        sql_params = (
            request.level.lower(),
            request.logger_name,
            request.message,
            request.profile_id,  # May be "guest-profile-id", SQL resolves it
            extra_json,
        )
        result = await conn.fetchrow(
            sql_query,
            request.level.lower(),
            request.logger_name,
            request.message,
            request.profile_id,
            extra_json,
        )

        log_id = result["id"] if result else None

        result_data = CreateLogResponse(success=True, log_id=log_id)

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_log",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
