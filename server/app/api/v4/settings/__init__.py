"""Settings resource router."""

from app.api.v4.settings.draft import router as draft_router
from app.api.v4.settings.get import router as get_router
from app.api.v4.settings.list import router as list_router
from app.api.v4.settings.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/settings", tags=["settings"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)  # Unified get endpoint
router.include_router(save_router)  # Unified save endpoint
router.include_router(draft_router)  # Draft endpoint
# Note: detail.py and update.py removed - use /get and /save instead
