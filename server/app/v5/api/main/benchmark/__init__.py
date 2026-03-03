"""Benchmark artifact router."""

from fastapi import APIRouter

from app.v5.api.main.benchmark.docs import router as docs_router
from app.v5.api.main.benchmark.get import router as get_router
from app.v5.api.main.benchmark.refresh import router as refresh_router

router = APIRouter(prefix="/benchmark", tags=["benchmark"])
router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(docs_router)
