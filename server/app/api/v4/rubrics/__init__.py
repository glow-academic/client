"""Rubrics v4 API routes."""

from fastapi import APIRouter

from app.api.v4.rubrics.create import router as create_router
from app.api.v4.rubrics.delete import router as delete_router
from app.api.v4.rubrics.detail import router as detail_router
from app.api.v4.rubrics.draft import router as draft_router
from app.api.v4.rubrics.duplicate import router as duplicate_router
from app.api.v4.rubrics.list import router as list_router
from app.api.v4.rubrics.new import router as new_router
from app.api.v4.rubrics.update import router as update_router

router = APIRouter(prefix="/rubrics", tags=["rubrics"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(duplicate_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(draft_router)
