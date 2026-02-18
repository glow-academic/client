"""Unified chat view router (attempt_chat_mv)."""

from fastapi import APIRouter

from app.api.v4.views.chat.get import router as get_router

router = APIRouter(prefix="/chat", tags=["views", "chat"])

router.include_router(get_router)
