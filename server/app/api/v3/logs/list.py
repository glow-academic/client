"""Logs list endpoint."""

import json
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class LogsListRequest(BaseModel):
    profileId: str


# Inline schemas (moved from app.schemas.logs)
class ActorData(BaseModel):
    """Actor JSONB data."""

    userId: str | None = None
    profileId: str | None = None
    profileName: str | None = None


class SubjectData(BaseModel):
    """Subject JSONB data."""

    entityId: str | None = None
    entityType: str | None = None


class ContextData(BaseModel):
    """Context JSONB data."""

    route: str | None = None
    function: str | None = None
    component: str | None = None
    provider: str | None = None
    model: str | None = None


class ErrorData(BaseModel):
    """Error JSONB data."""

    code: str | None = None
    name: str | None = None
    stack: str | None = None
    message: str | None = None


class LogItem(BaseModel):
    log_id: str
    event: str
    level: str
    message: str
    correlation_id: str | None
    actor: ActorData
    subject: SubjectData
    context: ContextData
    error: ErrorData
    created_at: str
    actor_name: str


class LogsListResponse(BaseModel):
    logs: list[LogItem]


router = APIRouter()


def _parse_jsonb_to_model(
    data: Any,
    model_class: type[ActorData] | type[SubjectData] | type[ContextData] | type[ErrorData],
) -> ActorData | SubjectData | ContextData | ErrorData:
    """Parse JSONB data to Pydantic model."""
    if isinstance(data, dict):
        return model_class(**data)
    return model_class()


@router.post("/list")
async def list_logs(
    request: LogsListRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LogsListResponse:
    """Get list of logs with actor information and all JSONB fields."""
    try:
        sql = load_sql("sql/v3/logs/get_logs_list.sql")
        rows = await conn.fetch(sql)

        log_items: list[LogItem] = []
        for row in rows:
            log_items.append(
                LogItem(
                    log_id=row["log_id"],
                    event=row["event"],
                    level=row["level"],
                    message=row["message"],
                    correlation_id=row["correlation_id"],
                    actor=cast(
                        ActorData, _parse_jsonb_to_model(row["actor"], ActorData)
                    ),
                    subject=cast(
                        SubjectData, _parse_jsonb_to_model(row["subject"], SubjectData)
                    ),
                    context=cast(
                        ContextData, _parse_jsonb_to_model(row["context"], ContextData)
                    ),
                    error=cast(ErrorData, _parse_jsonb_to_model(row["error"], ErrorData)),
                    created_at=row["created_at"].isoformat() if row["created_at"] else "",
                    actor_name=row["actor_name"],
                )
            )

        return LogsListResponse(logs=log_items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

