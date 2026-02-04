"""Activity feedbacks views router."""

from fastapi import APIRouter

from app.api.v4.views.activity.feedbacks.get import router as get_router

router = APIRouter(prefix="/feedbacks", tags=["views", "activity", "feedbacks"])
router.include_router(get_router)
