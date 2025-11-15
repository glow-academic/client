"""Logs resource router."""

from fastapi import APIRouter

from app.api.v3.logs.assistant_usage import router as assistant_usage_router
from app.api.v3.logs.bulk_delete import router as bulk_delete_router
from app.api.v3.logs.create import router as create_router
from app.api.v3.logs.health import router as health_router
from app.api.v3.logs.list import router as list_router
from app.api.v3.logs.recent import router as recent_router

router = APIRouter(prefix="/logs", tags=["logs"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(create_router)
router.include_router(bulk_delete_router)
router.include_router(health_router)
router.include_router(recent_router)
router.include_router(assistant_usage_router)
