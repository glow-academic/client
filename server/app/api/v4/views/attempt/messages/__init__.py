"""Attempt messages view router."""

from fastapi import APIRouter

from app.api.v4.views.attempt.messages.get import router as get_router
from app.api.v4.views.attempt.messages.recreate import router as recreate_router
from app.api.v4.views.attempt.messages.refresh import router as refresh_router

router = APIRouter(prefix="/messages", tags=["views", "attempt", "messages"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
