"""Recent logs endpoint - v3 API."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import get_pool, server
from app.utils.sql_helper import load_sql

router = APIRouter()


class RecentAppLogsRequest(BaseModel):
    """Request to get recent app logs."""

    level: str = "error"
    limit: int = 100


class LogEntry(BaseModel):
    """Log entry."""

    id: int
    level: str
    logger_name: str
    message: str
    extra: dict[str, Any] | None
    created_at: str


@router.post("/recent", response_model=list[LogEntry])
@server.tool()
async def recent_app_logs(
    request: RecentAppLogsRequest,
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
    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/logs/recent.sql")
            rows = await conn.fetch(sql, request.level, request.limit)

            results = []
            for row in rows:
                extra = row.get("extra")
                if isinstance(extra, str):
                    import json

                    try:
                        extra = json.loads(extra)
                    except Exception:
                        extra = None

                results.append(
                    LogEntry(
                        id=row["id"],
                        level=row["level"],
                        logger_name=row["logger_name"],
                        message=row["message"],
                        extra=extra if isinstance(extra, dict) else None,
                        created_at=row["created_at"].isoformat()
                        if row["created_at"]
                        else "",
                    )
                )

            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
