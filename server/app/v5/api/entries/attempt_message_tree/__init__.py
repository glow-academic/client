"""Attempt Message Tree entry endpoints."""

from fastapi import APIRouter

from app.v5.api.entries.attempt_message_tree.get import router as get_router
from app.v5.api.entries.attempt_message_tree.refresh import router as refresh_router
from app.v5.api.entries.attempt_message_tree.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
