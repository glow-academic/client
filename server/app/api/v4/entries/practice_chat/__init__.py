"""Practice Chat entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.practice_chat.get import router as get_router
from app.api.v4.entries.practice_chat.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
