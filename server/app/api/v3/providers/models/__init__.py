"""Models sub-router for providers."""

from fastapi import APIRouter

from app.api.v3.providers.models.detail import router as detail_router

router = APIRouter(prefix="/models", tags=["providers"])

# Include endpoint routers
router.include_router(detail_router)

