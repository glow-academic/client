"""Export router."""

from fastapi import APIRouter

from app.api.v4.export.certificate import router as certificate_router
from app.api.v4.export.report import router as report_router

router = APIRouter(prefix="/export", tags=["export"])

router.include_router(certificate_router)
router.include_router(report_router)
