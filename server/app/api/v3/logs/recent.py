"""Recent logs endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.main import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class RecentAppLogsRequest(BaseModel):
    """Request to get recent app logs."""

    level: str = "error"
    limit: int = 100


class LogEntry(BaseModel):
    """Log entry."""

    id: int
    level: str
    message: str
    context: dict[str, Any] | None
    created_at: str


@router.post("/recent", response_model=list[LogEntry])
@server.tool()
async def recent_app_logs(
    request: RecentAppLogsRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> list[LogEntry]:
    """
    🔎 Fetch recent ERROR/WARN app logs
    -----------------------------------
    Recent application logs filtered by level.

    Input
      • level – Log level filter ('error', 'warn', 'info', 'debug')
      • limit – Max results (default: 100)

    Returns
      [ { "id": …, "level": "…", "message": "…", … }, … ]

    Quick-start
      ask:  "Any critical errors today?"
      call: recent_app_logs("error")

    See also 👉 assistant_usage() for assistant-specific logs.
    """
    try:
        sql = load_sql("sql/v3/logs/recent.sql")
        rows = await conn.fetch(sql, request.level, request.limit)

        results = []
        for row in rows:
            context = row["context"]
            if isinstance(context, str):
                import json
                try:
                    context = json.loads(context)
                except:
                    context = None

            results.append(
                LogEntry(
                    id=row["id"],
                    level=row["level"],
                    message=row["message"],
                    context=context,
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                )
            )

        return results
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}"
        )

