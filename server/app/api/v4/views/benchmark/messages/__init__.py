"""Benchmark messages views router."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.messages.get import router as get_router

router = APIRouter(prefix="/messages", tags=["views", "benchmark", "messages"])
router.include_router(get_router)
