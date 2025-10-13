"""Main v1 API router."""

from app.api.v1.analytics.router import router as analytics_router
from fastapi import APIRouter

# Create main v1 router
router = APIRouter(prefix="/api/v1")

# Include analytics router
router.include_router(analytics_router)

