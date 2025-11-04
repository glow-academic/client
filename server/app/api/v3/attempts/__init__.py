"""Attempts resource router."""

from app.api.v3.attempts.bulk_archive import router as bulk_archive_router
from app.api.v3.attempts.full import router as full_router
from app.api.v3.attempts.update_chat_created_at import \
    router as update_chat_created_at_router
from fastapi import APIRouter

router = APIRouter(prefix="/attempts", tags=["attempts"])

# Include endpoint routers
router.include_router(bulk_archive_router)
router.include_router(update_chat_created_at_router)
router.include_router(full_router)

