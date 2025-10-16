# recent_app_logs.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict, List

import asyncpg  # type: ignore


async def recent_app_logs(conn: asyncpg.Connection, level: str = "error", limit: int = 100) -> List[Dict[str, Any]]:
    """Recent application logs filtered by level."""
    try:
        # Build query based on level filter
        if level.lower() == "all":
            query = """
                SELECT id, level, message, context, created_at
                FROM app_logs
                ORDER BY created_at DESC
                LIMIT $1
            """
            rows = await conn.fetch(query, limit)
        else:
            query = """
                SELECT id, level, message, context, created_at
                FROM app_logs
                WHERE LOWER(level) LIKE LOWER($1)
                ORDER BY created_at DESC
                LIMIT $2
            """
            rows = await conn.fetch(query, f"%{level.lower()}%", limit)

        results = [
            {
                "id": row["id"],
                "level": row["level"],
                "message": row["message"],
                "context": row["context"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in rows
        ]

        return results

    except Exception as e:
        return [{"error": f"Database error: {str(e)}"}]
