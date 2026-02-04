"""Activity audits views router."""

from fastapi import APIRouter

from app.api.v4.views.activity.audits.get import router as get_router

router = APIRouter(prefix="/audits", tags=["views", "activity", "audits"])
router.include_router(get_router)
