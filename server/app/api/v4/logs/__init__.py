"""Logs resource router."""

from fastapi import APIRouter

from app.api.v4.logs.bundle import router as bundle_router

router = APIRouter(prefix="/logs", tags=["logs"])

# Include endpoint routers
router.include_router(bundle_router)
