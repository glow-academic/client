"""Uploads v4 API routes."""

from fastapi import APIRouter

from app.api.v4.uploads.get import router as get_router
from app.api.v4.uploads.save import router as save_router

router = APIRouter(prefix="/uploads", tags=["uploads"])

router.include_router(get_router)
router.include_router(save_router)
