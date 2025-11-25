"""Images API router."""

from app.api.v3.images.download import router as download_router
from app.api.v3.images.upload_finalize import router as upload_finalize_router
from fastapi import APIRouter

router = APIRouter(prefix="/images", tags=["images"])

# Include endpoint routers
router.include_router(upload_finalize_router)
router.include_router(download_router)

__all__ = ["router"]

