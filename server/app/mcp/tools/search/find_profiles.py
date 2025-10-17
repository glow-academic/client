# find_profiles.py
#
# @AshokSaravanan222 & @siladiea
# 10/17/2025
#
# LIKE-only fuzzy-ish profile search (first, last, alias).
# Refactored to use ProfileService.
#

from __future__ import annotations

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.services.profile_service import ProfileService


async def find_profiles(
    conn: asyncpg.Connection, query: str, limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Find profiles by name using fuzzy first/last/alias search.
    
    Delegates to ProfileService.search_profiles().
    
    Args:
        conn: Database connection
        query: Search query string
        limit: Maximum number of results to return
        
    Returns:
        List of profile dictionaries with scores
    """
    try:
        service = ProfileService(conn)
        return await service.search_profiles(query, limit)
    except Exception as e:
        return [{"error": f"Search error: {str(e)}"}]
