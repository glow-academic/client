# profile_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.profile_service import ProfileService


async def profile_overview(conn: asyncpg.Connection, profile_id: str) -> Dict[str, Any]:
    """Profile overview with last login, classes, dashboard flags, and latest grades."""
    service = ProfileService(conn)
    return await service.get_profile_overview(profile_id)
