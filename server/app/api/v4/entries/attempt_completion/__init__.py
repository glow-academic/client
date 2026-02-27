"""Attempt Completion entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.attempt_completion.get import router as get_router
from app.api.v4.entries.attempt_completion.refresh import router as refresh_router
from app.api.v4.entries.attempt_completion.search import router as search_router
from app.api.v4.entries.attempt_completion.create import router as create_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(create_router)
