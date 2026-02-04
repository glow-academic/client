"""Analytics v4 API resource router.

Analytics endpoints now served via:
- /api/v4/views/analytics - view internal handlers
- /api/v4/artifacts/* - aggregated data for UI sections

This router only contains refresh endpoints for materialized views.
"""

from fastapi import APIRouter

from app.api.v4.analytics.refresh import router as refresh_router

router = APIRouter(prefix="/analytics", tags=["analytics"])

router.include_router(refresh_router)
