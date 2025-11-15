"""Log create endpoint."""

import json
from datetime import UTC, datetime
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas (simplified - actual schemas are more complex)
class CorrelationData(BaseModel):
    correlationId: str | None = None


class ActorData(BaseModel):
    userId: str | None = None
    profileId: str | None = None


class SubjectData(BaseModel):
    entityId: str | None = None
    entityType: str | None = None


class ContextData(BaseModel):
    route: str | None = None
    function: str | None = None
    component: str | None = None


class ErrorData(BaseModel):
    code: str | None = None
    name: str | None = None
    stack: str | None = None
    message: str | None = None


class CreateLogRequest(BaseModel):
    event: str
    level: str
    message: str
    correlation: CorrelationData | None = None
    actor: ActorData | None = None
    subject: SubjectData | None = None
    context: ContextData | None = None
    error: ErrorData | None = None


class CreateLogResponse(BaseModel):
    success: bool
    log_id: int | None


router = APIRouter()


def ensure_json(value: Any, default: dict[str, Any]) -> dict[str, Any]:  # noqa: ANN401
    """Ensure JSON-serializable values with defaults."""
    if value is None or not isinstance(value, dict):
        return default
    try:
        json.dumps(value)
        return cast(dict[str, Any], value)
    except (TypeError, ValueError):
        return default


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
        # Extract correlation_id from correlation object
        correlation_id = "default.correlation"
        if request.correlation and request.correlation.correlationId:
            correlation_id = request.correlation.correlationId

        # Prepare JSONB fields with database-matching defaults
        actor_json = ensure_json(request.actor, {"userId": None, "profileId": None})
        subject_json = ensure_json(
            request.subject, {"entityId": None, "entityType": None}
        )
        context_json = ensure_json(
            request.context, {"route": None, "function": None, "component": None}
        )
        error_json = ensure_json(
            request.error, {"code": None, "name": None, "stack": None, "message": None}
        )

        # Insert log entry
        sql_query = load_sql("sql/v3/logs/insert_log.sql")
        sql_params = (
            request.event,
            request.level,
            request.message,
            correlation_id,
            json.dumps(actor_json),
            json.dumps(subject_json),
            json.dumps(context_json),
            json.dumps(error_json),
            datetime.now(UTC),
        )
        result = await conn.fetchrow(
            sql_query,
            request.event,
            request.level,
            request.message,
            correlation_id,
            json.dumps(actor_json),
            json.dumps(subject_json),
            json.dumps(context_json),
            json.dumps(error_json),
            datetime.now(UTC),
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
