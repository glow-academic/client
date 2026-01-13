"""Fields v4 API routes."""

from fastapi import APIRouter

from app.api.v4.fields.delete import router as delete_router
from app.api.v4.fields.duplicate import router as duplicate_router
from app.api.v4.fields.get import router as get_router
from app.api.v4.fields.list import router as list_router
from app.api.v4.fields.save import router as save_router

router = APIRouter(prefix="/fields", tags=["fields"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
