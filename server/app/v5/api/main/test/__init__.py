"""Benchmark test artifact router."""

from fastapi import APIRouter

from app.v5.api.main.test.archive import router as archive_router
from app.v5.api.main.test.docs import router as docs_router
from app.v5.api.main.test.get import router as get_router

router = APIRouter(prefix="/test", tags=["artifacts", "test"])

router.include_router(get_router)
router.include_router(archive_router)
router.include_router(docs_router)
