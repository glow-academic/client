"""Benchmark artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.benchmark.docs import router as docs_router
from app.api.v4.artifacts.benchmark.draft import router as draft_router
from app.api.v4.artifacts.benchmark.get import router as get_router
from app.api.v4.artifacts.benchmark.list import router as list_router
from app.api.v4.artifacts.benchmark.refresh import router as refresh_router

router = APIRouter(prefix="/benchmark", tags=["benchmark"])
router.include_router(list_router)
router.include_router(refresh_router)
router.include_router(docs_router)
router.include_router(get_router)
router.include_router(draft_router)
