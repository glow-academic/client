"""Activity problems views router."""

from fastapi import APIRouter

from app.api.v4.views.activity.problems.get import router as get_router

router = APIRouter(prefix="/problems", tags=["views", "activity", "problems"])
router.include_router(get_router)
