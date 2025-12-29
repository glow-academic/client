"""Health resource router."""

from fastapi import APIRouter

from app.api.v3.health.bundle import router as bundle_router

router = APIRouter(prefix="/health", tags=["health"])

# Include endpoint routers
router.include_router(bundle_router)
