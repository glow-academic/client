"""{section.title()} analytics router."""

from fastapi import APIRouter

from app.api.v4.analytics.benchmark.get import router as get_router
from app.api.v4.analytics.benchmark.list import router as list_router

router = APIRouter(prefix="/benchmark", tags=["analytics", "benchmark"])

router.include_router(get_router)
router.include_router(list_router)
