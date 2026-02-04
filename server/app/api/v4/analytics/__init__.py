"""Analytics v4 API resource router.

Analytics endpoints now served via:
- /api/v4/views/analytics - view internal handlers
- /api/v4/artifacts/* - aggregated data for UI sections

Refresh is handled inline by mutation endpoints (e.g., archive).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["analytics"])
