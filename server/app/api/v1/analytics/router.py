"""Main analytics router combining all analytics endpoints."""

from app.api.v1.analytics import (bundles, footer, header, leaderboard, pages,
                                  primary, secondary, utility)
from fastapi import APIRouter

# Create main analytics router
router = APIRouter(prefix="/analytics", tags=["analytics"])

# Include all sub-routers
router.include_router(header.router)
router.include_router(primary.router)
router.include_router(secondary.router)
router.include_router(footer.router)
router.include_router(bundles.router)
router.include_router(pages.router)
router.include_router(leaderboard.router)
router.include_router(utility.router)

