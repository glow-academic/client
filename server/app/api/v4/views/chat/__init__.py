"""Unified chat view router (mv_chats)."""

from fastapi import APIRouter

from app.api.v4.views.chat.get import router as get_router

router = APIRouter(prefix="/chat", tags=["views", "chat"])

router.include_router(get_router)
