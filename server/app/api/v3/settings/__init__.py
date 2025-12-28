"""Settings resource router."""

from fastapi import APIRouter

from app.api.v3.settings.detail import router as detail_router
from app.api.v3.settings.list import router as list_router
from app.api.v3.settings.update import router as update_router

router = APIRouter(prefix="/settings", tags=["settings"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(update_router)
# Note: active endpoint removed - settings are fetched directly via SQL functions
