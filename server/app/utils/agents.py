"""
Utility functions for agent management
Handles department agent access via junction table
"""
import uuid
from typing import Any, Dict

import asyncpg  # type: ignore


async def get_department_agent(
    conn: asyncpg.Connection, 
    department_id: uuid.UUID, 
    role: str
) -> Dict[str, Any]:
    """
    Get agent for a department role via department_agents junction table.
    
    Args:
        conn: Database connection
        department_id: UUID of the department
        role: Agent role (title, scenario, classify, assistant, grade, 
              input_guardrail, output_guardrail, hint)
    
    Returns:
        Agent dict
        
    Raises:
        ValueError: If no agent found for the given department and role
    """
    link = await conn.fetchrow("""
        SELECT agent_id 
        FROM department_agents 
        WHERE department_id = $1 AND role = $2
    """, department_id, role)
    
    if not link:
        raise ValueError(
            f"No {role} agent configured for department {department_id}"
        )
    
    agent = await conn.fetchrow("""
        SELECT id, name, system_prompt, temperature, reasoning, model_id
        FROM agents 
        WHERE id = $1
    """, link['agent_id'])
    
    if not agent:
        raise ValueError(
            f"Agent {link['agent_id']} not found for {role} role in department {department_id}"
        )
    
    return dict(agent)

