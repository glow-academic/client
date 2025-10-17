# find_cohorts.py
#
# @AshokSaravanan222 & @siladiea
# 10/17/2025
#
# LIKE-only fuzzy-ish cohort search (title + description).
# Refactored to use CohortService.
#

from __future__ import annotations

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.services.cohort_service import CohortService


async def find_cohorts(
    conn: asyncpg.Connection, query: str, limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Find cohorts by title/description using fuzzy search.
    
    Delegates to CohortService.search_cohorts().
    
    Args:
        conn: Database connection
        query: Search query string
        limit: Maximum number of results to return
        
    Returns:
        List of cohort dictionaries with scores and profile counts
    """
    try:
        service = CohortService(conn)
        return await service.search_cohorts(query, limit)
    except Exception as e:
        return [{"error": f"Search error: {str(e)}"}]
