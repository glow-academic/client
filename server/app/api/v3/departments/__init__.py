"""Departments v3 API routes."""

from fastapi import APIRouter

from app.api.v3.departments.create import router as create_router
from app.api.v3.departments.delete import router as delete_router
from app.api.v3.departments.detail import router as detail_router
from app.api.v3.departments.detail_default import router as detail_default_router
from app.api.v3.departments.duplicate import router as duplicate_router
from app.api.v3.departments.list import router as list_router
from app.api.v3.departments.remove_profiles import router as remove_profiles_router
from app.api.v3.departments.update import router as update_router

router = APIRouter(prefix="/departments", tags=["departments"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_default_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(remove_profiles_router)

