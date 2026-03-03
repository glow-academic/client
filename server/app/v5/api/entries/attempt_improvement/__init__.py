"""Attempt Improvement entry endpoints."""

from fastapi import APIRouter

from app.v5.api.entries.attempt_improvement.create import router as create_router
from app.v5.api.entries.attempt_improvement.get import router as get_router
from app.v5.api.entries.attempt_improvement.refresh import router as refresh_router
from app.v5.api.entries.attempt_improvement.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(create_router)
