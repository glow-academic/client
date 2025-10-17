# assistant_usage.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.assistant_service import AssistantService


async def assistant_usage(conn: asyncpg.Connection, days: int = 7) -> Dict[str, Any]:
    """Show assistant chat usage over time period."""
    try:
        service = AssistantService(conn)
        return await service.get_usage_stats(days)
    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
