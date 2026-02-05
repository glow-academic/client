"""Benchmark artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.benchmark.get import router as get_router
from app.api.v4.artifacts.benchmark.refresh import router as refresh_router

router = APIRouter()
router.include_router(get_router)
router.include_router(refresh_router)
