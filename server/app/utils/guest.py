from typing import Any, Dict, Optional

import asyncpg  # type: ignore


async def find_default_guest_profile(conn: asyncpg.Connection) -> Optional[Dict[str, Any]]:
    """Find the default guest profile."""
    result = await conn.fetchrow(
        "SELECT * FROM profiles WHERE role = 'guest' AND default_profile = true LIMIT 1"
    )
    return dict(result) if result else None
