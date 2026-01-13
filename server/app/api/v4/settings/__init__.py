"""Settings resource router."""

from fastapi import APIRouter

from app.api.v4.settings.detail import router as detail_router
from app.api.v4.settings.draft import router as draft_router
from app.api.v4.settings.get import router as get_router
from app.api.v4.settings.list import router as list_router
from app.api.v4.settings.save import router as save_router
from app.api.v4.settings.update import router as update_router

router = APIRouter(prefix="/settings", tags=["settings"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)  # New unified get endpoint
router.include_router(save_router)  # New unified save endpoint
router.include_router(draft_router)  # New draft endpoint
# Keep old endpoints for backward compatibility (deprecated)
router.include_router(detail_router)  # Deprecated: use /get instead
router.include_router(update_router)  # Deprecated: use /save instead
# Note: active endpoint removed - settings are fetched directly via SQL functions
