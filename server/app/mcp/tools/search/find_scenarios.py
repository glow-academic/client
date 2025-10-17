# find_scenarios.py
#
# @AshokSaravanan222 & @siladiea
# 10/17/2025
#
# LIKE-only fuzzy-ish scenario search (name + problem_statement).
# Refactored to use ScenarioService.
#

from __future__ import annotations

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.services.scenario_service import ScenarioService


async def find_scenarios(
    conn: asyncpg.Connection, query: str, limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Find scenarios by name/problem_statement using fuzzy search.
    
    Delegates to ScenarioService.search_scenarios().
    
    Args:
        conn: Database connection
        query: Search query string
        limit: Maximum number of results to return
        
    Returns:
        List of scenario dictionaries with scores
    """
    try:
        service = ScenarioService(conn)
        return await service.search_scenarios(query, limit)
    except Exception as e:
        return [{"error": f"Search error: {str(e)}"}]
