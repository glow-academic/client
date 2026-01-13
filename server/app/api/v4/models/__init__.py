"""Models resource router."""

from app.api.v4.models.delete import router as delete_router
from app.api.v4.models.duplicate import router as duplicate_router
from app.api.v4.models.get import router as get_router
from app.api.v4.models.list import router as list_router
from app.api.v4.models.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/models", tags=["models"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(delete_router)
router.include_router(duplicate_router)
