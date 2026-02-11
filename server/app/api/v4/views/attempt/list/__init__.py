"""Attempt list view router."""

from fastapi import APIRouter

from app.api.v4.views.attempt.list.get import router as get_router
from app.api.v4.views.attempt.list.recreate import router as recreate_router
from app.api.v4.views.attempt.list.refresh import router as refresh_router

router = APIRouter(prefix="/list", tags=["views", "attempt", "list"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
