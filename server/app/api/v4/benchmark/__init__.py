"""Benchmark v4 API router."""

from fastapi import APIRouter

from app.api.v4.benchmark.history import router as history_router
from app.api.v4.benchmark.overview import router as overview_router

router = APIRouter(prefix="/benchmark", tags=["benchmark"])
router.include_router(overview_router)
router.include_router(history_router)
