"""Providers resource router."""

from fastapi import APIRouter

from app.api.v3.providers.create import router as create_router
from app.api.v3.providers.delete import router as delete_router
from app.api.v3.providers.detail import router as detail_router
from app.api.v3.providers.list import router as list_router
from app.api.v3.providers.new import router as new_router
from app.api.v3.providers.update import router as update_router

router = APIRouter(prefix="/providers", tags=["providers"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
