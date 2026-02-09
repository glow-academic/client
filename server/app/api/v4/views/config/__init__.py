"""Config view router."""

from fastapi import APIRouter

from app.api.v4.views.config.get import router as get_router
from app.api.v4.views.config.recreate import router as recreate_router
from app.api.v4.views.config.refresh import router as refresh_router

router = APIRouter(prefix="/config", tags=["views", "config"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
