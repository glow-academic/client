"""Benchmark tests views router."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.tests.get import router as get_router
from app.api.v4.views.benchmark.tests.refresh import router as refresh_router

router = APIRouter(prefix="/tests", tags=["views", "benchmark", "tests"])
router.include_router(get_router)
router.include_router(refresh_router)
