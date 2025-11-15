"""Assistant v3 API router."""

from fastapi import APIRouter

from app.api.v3.assistant.chat_full import router as chat_full_router
from app.api.v3.assistant.chat_list import router as chat_list_router

router = APIRouter(prefix="/assistant", tags=["assistant"])

router.include_router(chat_full_router)
router.include_router(chat_list_router)
