# recent_app_logs.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.services.log_service import LogService


async def recent_app_logs(conn: asyncpg.Connection, level: str = "error", limit: int = 100) -> List[Dict[str, Any]]:
    """Recent application logs filtered by level."""
    try:
        service = LogService(conn)
        return await service.get_recent_logs(level, limit)
    except Exception as e:
        return [{"error": f"Database error: {str(e)}"}]
