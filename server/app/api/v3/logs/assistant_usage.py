"""Assistant usage endpoint - v3 API."""

import json
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import get_pool, server
from app.utils.sql_helper import load_sql

router = APIRouter()


class AssistantUsageRequest(BaseModel):
    """Request to get assistant usage stats."""

    days: int = 7


class AssistantUsageResponse(BaseModel):
    """Response with assistant usage statistics."""

    summary: dict[str, Any]
    daily_stats: list[dict[str, Any]]
    top_users: list[dict[str, Any]]


@router.post("/assistant-usage", response_model=AssistantUsageResponse)
@server.tool()
async def assistant_usage(
    request: AssistantUsageRequest,
) -> AssistantUsageResponse:
    """
    📊 Assistant usage statistics
    -----------------------------
    Show assistant chat usage over time period.

    Input
      • days – Analysis window in days (default: 7)

    Returns
      { "summary": {…}, "daily_stats": […], "top_users": […] }

    Quick-start
      ask:  "Show assistant usage last 7 days"
      call: assistant_usage(7)

    See also 👉 recent_app_logs() for system logs.
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            cutoff_date = datetime.now() - timedelta(days=request.days)
            sql = load_sql("sql/v3/logs/assistant_usage.sql")
            result = await conn.fetchrow(sql, cutoff_date)

            if not result:
                raise HTTPException(status_code=404, detail="No data found")

            # Parse JSON fields
            chats = []
            chats_data = result["chats"]
            if isinstance(chats_data, str):
                chats_data = json.loads(chats_data)
            if chats_data and isinstance(chats_data, list):
                chats = chats_data

            messages = []
            messages_data = result["messages"]
            if isinstance(messages_data, str):
                messages_data = json.loads(messages_data)
            if messages_data and isinstance(messages_data, list):
                messages = messages_data

            tool_calls = []
            tool_calls_data = result["tool_calls"]
            if isinstance(tool_calls_data, str):
                tool_calls_data = json.loads(tool_calls_data)
            if tool_calls_data and isinstance(tool_calls_data, list):
                tool_calls = tool_calls_data

            top_users = []
            top_users_data = result["top_users"]
            if isinstance(top_users_data, str):
                top_users_data = json.loads(top_users_data)
            if top_users_data and isinstance(top_users_data, list):
                top_users = top_users_data

            # Calculate summary
            completed_messages = sum(1 for m in messages if m.get("completed"))
            completed_tool_calls = sum(1 for tc in tool_calls if tc.get("completed"))

            summary = {
                "total_chats": len(chats),
                "total_messages": len(messages),
                "completed_messages": completed_messages,
                "total_tool_calls": len(tool_calls),
                "completed_tool_calls": completed_tool_calls,
            }

            # Calculate daily stats (simplified - group by date)
            daily_stats = []
            # This is a simplified version - in production you'd want proper date grouping
            daily_stats.append(
                {
                    "date": cutoff_date.date().isoformat(),
                    "chats": len(chats),
                    "messages": len(messages),
                }
            )

            return AssistantUsageResponse(
                summary=summary, daily_stats=daily_stats, top_users=top_users
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
