"""Benchmark test artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.test.archive import router as archive_router
from app.api.v4.artifacts.test.get import router as get_router
from app.api.v4.artifacts.test.list import router as list_router

router = APIRouter(tags=["artifacts", "test"])

router.include_router(get_router)
router.include_router(list_router)
router.include_router(archive_router)
