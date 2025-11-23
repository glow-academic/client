"""Cached guest profile UUID utility.

Provides a cached lookup for the default guest profile UUID to avoid
repeated database queries when resolving "guest-profile-id" strings.
"""

import logging
from typing import Any

import asyncpg  # type: ignore

logger = logging.getLogger(__name__)

# Cached guest profile UUID (set at startup)
_guest_profile_id: str | None = None


async def initialize_guest_profile(db_pool: asyncpg.Pool) -> None:
    """Initialize cached guest profile UUID from database.
    
    Args:
        db_pool: Database connection pool
        
    Raises:
        RuntimeError: If no default guest profile is found in database
    """
    global _guest_profile_id
    
    try:
        async with db_pool.acquire() as conn:
            result = await conn.fetchval(
                """
                SELECT id::text
                FROM profiles
                WHERE role = 'guest' AND default_profile = true
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            
            if result:
                _guest_profile_id = str(result)
                logger.info(f"✅ Cached guest profile UUID: {_guest_profile_id}")
            else:
                # Fallback to placeholder if no guest profile found
                _guest_profile_id = "00000000-0000-0000-0000-000000000000"
                logger.warning(
                    "⚠️  No default guest profile found in database; using placeholder UUID"
                )
    except Exception as e:
        logger.error(f"Error initializing guest profile: {e}", exc_info=True)
        # Fallback to placeholder on error
        _guest_profile_id = "00000000-0000-0000-0000-000000000000"


def get_guest_profile_id() -> str:
    """Get the cached guest profile UUID.
    
    Returns:
        Guest profile UUID string (never null, may be placeholder if not initialized)
        
    Raises:
        RuntimeError: If guest profile has not been initialized
    """
    if _guest_profile_id is None:
        raise RuntimeError(
            "Guest profile UUID not initialized. Call initialize_guest_profile() at startup."
        )
    return _guest_profile_id


def resolve_profile_id(profile_id: str | None) -> str:
    """Resolve 'guest-profile-id' to actual guest UUID using cached value.
    
    Args:
        profile_id: Profile ID string, may be "guest-profile-id", None, or actual UUID
        
    Returns:
        Resolved UUID string (never null)
        
    Raises:
        RuntimeError: If guest profile has not been initialized
    """
    if not profile_id or profile_id == "guest-profile-id":
        return get_guest_profile_id()
    
    return profile_id

