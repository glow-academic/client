"""Videos v3 router."""

from fastapi import APIRouter

from app.api.v3.videos.create import router as create_router
from app.api.v3.videos.delete import router as delete_router
from app.api.v3.videos.detail import router as detail_router
from app.api.v3.videos.detail_default import router as detail_default_router
from app.api.v3.videos.duplicate import router as duplicate_router
from app.api.v3.videos.list import router as list_router
from app.api.v3.videos.search import router as search_router
from app.api.v3.videos.update import router as update_router

router = APIRouter(prefix="/videos", tags=["videos"])

# Include all video endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_default_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(search_router)

