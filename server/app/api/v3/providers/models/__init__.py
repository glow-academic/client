"""Models sub-router for providers."""

from app.api.v3.providers.models.create import router as create_router
from app.api.v3.providers.models.delete import router as delete_router
from app.api.v3.providers.models.detail import router as detail_router
from app.api.v3.providers.models.duplicate import router as duplicate_router
from app.api.v3.providers.models.update import router as update_router
from fastapi import APIRouter

router = APIRouter(prefix="/models", tags=["providers"])

# Include endpoint routers
router.include_router(detail_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(duplicate_router)
