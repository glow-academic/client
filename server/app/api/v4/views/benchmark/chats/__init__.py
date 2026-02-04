"""Benchmark chats views router."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.chats.get import router as get_router
from app.api.v4.views.benchmark.chats.refresh import router as refresh_router

router = APIRouter(prefix="/chats", tags=["views", "benchmark", "chats"])
router.include_router(get_router)
router.include_router(refresh_router)
