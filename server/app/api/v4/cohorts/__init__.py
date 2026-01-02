"""Cohorts v4 API routes."""

from fastapi import APIRouter

from app.api.v4.cohorts.create import router as create_router
from app.api.v4.cohorts.delete import router as delete_router
from app.api.v4.cohorts.detail import router as detail_router
from app.api.v4.cohorts.draft import router as draft_router
from app.api.v4.cohorts.duplicate import router as duplicate_router
from app.api.v4.cohorts.leave import router as leave_router
from app.api.v4.cohorts.list import router as list_router
from app.api.v4.cohorts.new import router as new_router
from app.api.v4.cohorts.search import router as search_router
from app.api.v4.cohorts.update import router as update_router

router = APIRouter(prefix="/cohorts", tags=["cohorts"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(duplicate_router)
router.include_router(leave_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(search_router)
router.include_router(draft_router)
