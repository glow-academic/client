"""Utility function to get tool_id by tool name."""

import uuid

import asyncpg  # type: ignore
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


async def get_tool_id_by_name(
    conn: asyncpg.Connection, tool_name: str
) -> uuid.UUID | None:
    """Get tool_id by tool name from the tools table.
    
    Args:
        conn: Database connection
        tool_name: Name of the tool (e.g., "speak", "set_title_and_description")
        
    Returns:
        tool_id (UUID) if found, None otherwise
    """
    sql_get_tool_id = """
        SELECT id FROM tools 
        WHERE name = $1::text AND active = TRUE
        LIMIT 1
    """
    
    try:
        row = await conn.fetchrow(sql_get_tool_id, tool_name)
        if row:
            return row["id"]
        else:
            logger.warning(f"Tool not found: {tool_name}")
            return None
    except Exception as e:
        logger.error(f"Error looking up tool_id for {tool_name}: {e}", exc_info=True)
        return None

