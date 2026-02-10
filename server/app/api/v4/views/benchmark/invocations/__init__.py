"""Benchmark invocations views router."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.invocations.get import router as get_router
from app.api.v4.views.benchmark.invocations.refresh import router as refresh_router

router = APIRouter(
    prefix="/invocations", tags=["views", "benchmark", "invocations"]
)
router.include_router(get_router)
router.include_router(refresh_router)
