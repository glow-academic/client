"""Attempt overview view router."""

from fastapi import APIRouter

from app.api.v4.views.attempt.overview.get import router as get_router
from app.api.v4.views.attempt.overview.recreate import router as recreate_router
from app.api.v4.views.attempt.overview.refresh import router as refresh_router

router = APIRouter(prefix="/overview", tags=["views", "attempt", "overview"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
