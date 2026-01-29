"""Benchmark attempts router."""

from fastapi import APIRouter

from app.api.v4.attempts.benchmark.archive import router as archive_router
from app.api.v4.attempts.benchmark.get import router as get_router

router = APIRouter(prefix="/benchmark", tags=["attempts", "benchmark"])

router.include_router(get_router)
router.include_router(archive_router)
