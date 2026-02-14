"""Benchmark views API routes."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.bundle import router as bundle_router
from app.api.v4.views.benchmark.context import router as context_router
from app.api.v4.views.benchmark.invocations import router as invocations_router
from app.api.v4.views.benchmark.tests import router as tests_router

router = APIRouter(prefix="/benchmark", tags=["views", "benchmark"])

router.include_router(context_router)
router.include_router(tests_router)
router.include_router(invocations_router)
router.include_router(bundle_router)
