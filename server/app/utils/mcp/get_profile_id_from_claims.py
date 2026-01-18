"""Utility to extract profile_id from OAuth token claims."""

from typing import Any

import asyncpg  # type: ignore
from app.utils.sql_helper import execute_sql_typed


async def get_profile_id_from_claims(
    claims: dict[str, Any],
    conn: asyncpg.Connection,
) -> str | None:
    """Extract profile_id from OAuth token claims.
    
    Strategy:
    1. Extract email from claims (primary method)
    2. Query profiles table via profile_emails junction and emails_resource
    3. Return profile_id UUID string or None
    
    Args:
        claims: OAuth token claims dict (from request.state.mcp_claims)
        conn: Database connection
        
    Returns:
        Profile ID UUID string or None if not found
    """
    email = claims.get("email")
    if not email:
        return None
    
    # Query profile_id from email using existing SQL function
    # We'll use a simple query that matches the pattern used elsewhere
    query = """
        SELECT p.id::text as profile_id
        FROM profile_artifact p
        JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
        JOIN emails_resource e ON pe.email_id = e.id
        WHERE e.email = $1
        LIMIT 1
    """
    
    try:
        result = await conn.fetchrow(query, email)
        if result:
            profile_id_value = result.get("profile_id")
            if profile_id_value:
                return str(profile_id_value)
        return None
    except Exception:
        # Log error but don't raise - let caller handle None
        return None
