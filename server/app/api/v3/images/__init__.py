"""Images API router."""

from fastapi import APIRouter

from app.api.v3.images.create import router as create_router

router = APIRouter(prefix="/images", tags=["images"])

router.include_router(create_router)

__all__ = ["router"]

