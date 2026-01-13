"""Providers resource router."""

from fastapi import APIRouter

from app.api.v4.providers.delete import router as delete_router
from app.api.v4.providers.draft import router as draft_router
from app.api.v4.providers.get import router as get_router
from app.api.v4.providers.list import router as list_router
from app.api.v4.providers.save import router as save_router

router = APIRouter(prefix="/providers", tags=["providers"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(draft_router)
router.include_router(delete_router)
