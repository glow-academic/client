"""Bulk operations router."""

from fastapi import APIRouter

from app.api.v4.bulk.staff import router as staff_router
from app.api.v4.bulk.document import router as document_router

router = APIRouter(prefix="/bulk", tags=["bulk"])

router.include_router(staff_router)
router.include_router(document_router)
