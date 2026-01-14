"""Rubrics v4 API routes."""

from app.api.v4.rubrics.delete import router as delete_router
from app.api.v4.rubrics.duplicate import router as duplicate_router
from app.api.v4.rubrics.get import router as get_router
from app.api.v4.rubrics.list import router as list_router
from app.api.v4.rubrics.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/rubrics", tags=["rubrics"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
