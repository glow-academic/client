"""Models resource router."""

from fastapi import APIRouter

from app.api.v3.models.create import router as create_router
from app.api.v3.models.delete import router as delete_router
from app.api.v3.models.detail import router as detail_router
from app.api.v3.models.duplicate import router as duplicate_router
from app.api.v3.models.list import router as list_router
from app.api.v3.models.new import router as new_router
from app.api.v3.models.update import router as update_router

router = APIRouter(prefix="/models", tags=["models"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(duplicate_router)
