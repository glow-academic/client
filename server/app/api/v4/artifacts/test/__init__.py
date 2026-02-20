"""Benchmark test artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.test.archive import router as archive_router
from app.api.v4.artifacts.test.docs import router as docs_router
from app.api.v4.artifacts.test.get import router as get_router

router = APIRouter(prefix="/test", tags=["artifacts", "test"])

router.include_router(get_router)
router.include_router(archive_router)
router.include_router(docs_router)
