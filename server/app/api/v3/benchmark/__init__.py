"""Benchmark v3 API router."""

from fastapi import APIRouter

from app.api.v3.benchmark.bundle import router as bundle_router

router = APIRouter(prefix="/benchmark", tags=["benchmark"])
router.include_router(bundle_router)

