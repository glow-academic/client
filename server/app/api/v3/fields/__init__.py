"""Fields v3 API routes."""

from fastapi import APIRouter

from app.api.v3.fields.create import router as create_router
from app.api.v3.fields.delete import router as delete_router
from app.api.v3.fields.detail import router as detail_router
from app.api.v3.fields.duplicate import router as duplicate_router
from app.api.v3.fields.list import router as list_router
from app.api.v3.fields.new import router as new_router
from app.api.v3.fields.update import router as update_router

router = APIRouter(prefix="/fields", tags=["fields"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
