"""Health artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.health.docs import router as docs_router
from app.routes.v5.api.main.health.get import router as get_router
from app.routes.v5.api.main.health.refresh import router as refresh_router

router = APIRouter(prefix="/health", tags=["health"])
router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(docs_router)
