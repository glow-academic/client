"""Attempts resource router."""

from app.api.v3.attempts.archive import router as archive_router
from app.api.v3.attempts.full import router as full_router
from fastapi import APIRouter

router = APIRouter(prefix="/attempts", tags=["attempts"])

# Include endpoint routers
router.include_router(archive_router)
router.include_router(full_router)
