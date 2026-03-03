"""Conversations entry endpoints."""

from fastapi import APIRouter

from app.routes.v5.api.entries.conversations.create import router as create_router
from app.routes.v5.api.entries.conversations.get import router as get_router
from app.routes.v5.api.entries.conversations.refresh import router as refresh_router
from app.routes.v5.api.entries.conversations.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(create_router)
