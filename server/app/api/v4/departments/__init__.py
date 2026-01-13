"""Departments v4 API routes."""

from fastapi import APIRouter

from app.api.v4.departments.delete import router as delete_router
from app.api.v4.departments.duplicate import router as duplicate_router
from app.api.v4.departments.get import router as get_router
from app.api.v4.departments.list import router as list_router
from app.api.v4.departments.save import router as save_router

router = APIRouter(prefix="/departments", tags=["departments"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
