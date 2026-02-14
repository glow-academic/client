"""Benchmark artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.benchmark.bundle import router as bundle_router
from app.api.v4.artifacts.benchmark.docs import router as docs_router
from app.api.v4.artifacts.benchmark.refresh import router as refresh_router

router = APIRouter(prefix="/benchmark", tags=["benchmark"])
router.include_router(refresh_router)
router.include_router(docs_router)
router.include_router(bundle_router)
