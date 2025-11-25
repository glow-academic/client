"""Logs resource router."""

from app.api.v3.logs.bulk_delete import router as bulk_delete_router
from app.api.v3.logs.bundle import router as bundle_router
from app.api.v3.logs.create import router as create_router
from app.api.v3.logs.health import router as health_router
from app.api.v3.logs.list import router as list_router
from app.api.v3.logs.recent import router as recent_router
from app.api.v3.logs.runs import router as runs_router
from fastapi import APIRouter

router = APIRouter(prefix="/logs", tags=["logs"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(create_router)
router.include_router(bulk_delete_router)
router.include_router(health_router)
router.include_router(recent_router)
router.include_router(bundle_router)
router.include_router(runs_router)
