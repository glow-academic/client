"""
Utility functions for agent management
Handles department agent access via junction table
"""
import uuid

from app.models import Agents, DepartmentAgents
from sqlmodel import Session, select


def get_department_agent(
    session: Session, 
    department_id: uuid.UUID, 
    role: str
) -> Agents:
    """
    Get agent for a department role via department_agents junction table.
    
    Args:
        session: Database session
        department_id: UUID of the department
        role: Agent role (title, scenario, classify, assistant, grade, 
              input_guardrail, output_guardrail, hint)
    
    Returns:
        Agent model instance
        
    Raises:
        ValueError: If no agent found for the given department and role
    """
    link = session.exec(
        select(DepartmentAgents)
        .where(DepartmentAgents.department_id == department_id)
        .where(DepartmentAgents.role == role)
    ).one_or_none()
    
    if not link:
        raise ValueError(
            f"No {role} agent configured for department {department_id}"
        )
    
    agent = session.exec(
        select(Agents).where(Agents.id == link.agent_id)
    ).one_or_none()
    
    if not agent:
        raise ValueError(
            f"Agent {link.agent_id} not found for {role} role in department {department_id}"
        )
    
    return agent

