"""Videos v3 router."""

from app.api.v3.videos.create import router as create_router
from app.api.v3.videos.delete import router as delete_router
from app.api.v3.videos.detail import router as detail_router
from app.api.v3.videos.new import router as new_router
from app.api.v3.videos.duplicate import router as duplicate_router
from app.api.v3.videos.list import router as list_router
from app.api.v3.videos.randomize import router as randomize_router
from app.api.v3.videos.search import router as search_router
from app.api.v3.videos.update import router as update_router
from fastapi import APIRouter

router = APIRouter(prefix="/videos", tags=["videos"])

# Include all video endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(search_router)
router.include_router(randomize_router)

