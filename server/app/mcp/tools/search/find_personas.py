# find_personas.py
#
# @AshokSaravanan222 & @siladiea
# 10/17/2025
#
# LIKE-only fuzzy-ish persona search (name).
# Refactored to use PersonaService.
#

from __future__ import annotations

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.services.persona_service import PersonaService


async def find_personas(
    conn: asyncpg.Connection, query: str, limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Find personas by name using fuzzy search.
    
    Delegates to PersonaService.search_personas().
    
    Args:
        conn: Database connection
        query: Search query string
        limit: Maximum number of results to return
        
    Returns:
        List of persona dictionaries with scores
    """
    try:
        service = PersonaService(conn)
        return await service.search_personas(query, limit)
    except Exception as e:
        return [{"error": f"Search error: {str(e)}"}]
