# find_simulations.py
#
# @AshokSaravanan222 & @siladiea
# 10/17/2025
#
# LIKE-only fuzzy-ish simulation title search.
# Refactored to use SimulationService.
#

from __future__ import annotations

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.services.simulation_service import SimulationService


async def find_simulations(
    conn: asyncpg.Connection, query: str, limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Find simulations by title using fuzzy search.
    
    Delegates to SimulationService.search_simulations().
    
    Args:
        conn: Database connection
        query: Search query string
        limit: Maximum number of results to return
        
    Returns:
        List of simulation dictionaries with scores
    """
    try:
        service = SimulationService(conn)
        return await service.search_simulations(query, limit)
    except Exception as e:
        return [{"error": f"Search error: {str(e)}"}]
