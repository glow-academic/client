"""Logs resource router."""

from fastapi import APIRouter

from app.api.v3.logs.bulk_delete import router as bulk_delete_router
from app.api.v3.logs.bundle import router as bundle_router
from app.api.v3.logs.runs import router as runs_router

router = APIRouter(prefix="/logs", tags=["logs"])

# Include endpoint routers
router.include_router(bulk_delete_router)
router.include_router(bundle_router)
router.include_router(runs_router)
