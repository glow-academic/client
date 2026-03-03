"""Home Chat entry endpoints."""

from fastapi import APIRouter

from app.routes.v5.api.entries.home_chat.get import router as get_router
from app.routes.v5.api.entries.home_chat.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
