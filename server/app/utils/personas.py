# app/utils/personas.py
from typing import Dict

from agents.items import TResponseInputItem


def format_persona_info(persona_data: Dict[str, str]) -> TResponseInputItem:
    """
    Format persona information as TResponseInputItem.
    
    Args:
        persona_data: Dict with 'name' and 'description' keys
    
    Returns:
        TResponseInputItem formatted for agent input
    """
    return {
        "role": "user",
        "content": f"This is the profile of the student: Name: {persona_data['name']} Description: {persona_data.get('description', '')}",
    }
