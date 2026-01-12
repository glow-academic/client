"""Cohorts v4 API routes."""

from fastapi import APIRouter

from app.api.v4.cohorts.delete import router as delete_router
from app.api.v4.cohorts.duplicate import router as duplicate_router
from app.api.v4.cohorts.get import router as get_router
from app.api.v4.cohorts.leave import router as leave_router
from app.api.v4.cohorts.list import router as list_router
from app.api.v4.cohorts.save import router as save_router
from app.api.v4.cohorts.search import router as search_router

router = APIRouter(prefix="/cohorts", tags=["cohorts"])

# Include endpoint routers (unified endpoints only)
router.include_router(list_router)
router.include_router(get_router)  # Unified: handles both new and detail
router.include_router(save_router)  # Unified: handles both create and update
router.include_router(duplicate_router)
router.include_router(leave_router)
router.include_router(delete_router)
router.include_router(search_router)
