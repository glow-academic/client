"""Main v2 API router."""

from app.api.v2.analytics.router import router as analytics_router
from app.api.v2.personas import router as personas_router
from fastapi import APIRouter

# Create main v2 router
router = APIRouter(prefix="/api/v2")

# Include analytics router
router.include_router(analytics_router)

# Include personas router
router.include_router(personas_router)

