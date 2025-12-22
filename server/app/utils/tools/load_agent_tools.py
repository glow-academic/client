"""Load agent tools from database."""

import uuid
from typing import Any

import asyncpg  # type: ignore

from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


async def load_agent_tools(
    conn: asyncpg.Connection, agent_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Load all active tools for an agent from database.
    
    Args:
        conn: Database connection
        agent_id: UUID of the agent
        
    Returns:
        List of tool config dicts with keys: id, name, description, tool_type, 
        agent_role, arguments, argument_descriptions, argument_defaults, active
    """
    sql_get_agent_tools = load_sql("sql/v3/agents/get_agent_tools.sql")
    
    try:
        rows = await conn.fetch(sql_get_agent_tools, str(agent_id))
        tools = [dict(row) for row in rows]
        logger.debug(f"Loaded {len(tools)} tools for agent {agent_id}")
        return tools
    except Exception as e:
        logger.error(f"Error loading agent tools for {agent_id}: {e}", exc_info=True)
        return []

