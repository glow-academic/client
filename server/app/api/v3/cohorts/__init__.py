"""Cohorts v3 API routes."""

from fastapi import APIRouter

from app.api.v3.cohorts.add_profiles import router as add_profiles_router
from app.api.v3.cohorts.create import router as create_router
from app.api.v3.cohorts.delete import router as delete_router
from app.api.v3.cohorts.detail import router as detail_router
from app.api.v3.cohorts.detail_default import router as detail_default_router
from app.api.v3.cohorts.detail_with_profiles import router as detail_with_profiles_router
from app.api.v3.cohorts.duplicate import router as duplicate_router
from app.api.v3.cohorts.leave import router as leave_router
from app.api.v3.cohorts.list import router as list_router
from app.api.v3.cohorts.overview import router as overview_router
from app.api.v3.cohorts.pass_matrix import router as pass_matrix_router
from app.api.v3.cohorts.remove_profiles import router as remove_profiles_router
from app.api.v3.cohorts.search import router as search_router
from app.api.v3.cohorts.update import router as update_router

router = APIRouter(prefix="/cohorts", tags=["cohorts"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_default_router)
router.include_router(detail_with_profiles_router)
router.include_router(duplicate_router)
router.include_router(leave_router)
router.include_router(add_profiles_router)
router.include_router(remove_profiles_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(overview_router)
router.include_router(search_router)
router.include_router(pass_matrix_router)

