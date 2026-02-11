"""Attempt chats view router."""

from fastapi import APIRouter

from app.api.v4.views.attempt.chats.get import router as get_router
from app.api.v4.views.attempt.chats.recreate import router as recreate_router
from app.api.v4.views.attempt.chats.refresh import router as refresh_router

router = APIRouter(prefix="/chats", tags=["views", "attempt", "chats"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
