"""Benchmark tests views router."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.tests.get import router as get_router

router = APIRouter(prefix="/tests", tags=["views", "benchmark", "tests"])
router.include_router(get_router)
