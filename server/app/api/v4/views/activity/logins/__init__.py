"""Activity logins views router."""

from fastapi import APIRouter

from app.api.v4.views.activity.logins.get import router as get_router

router = APIRouter(prefix="/logins", tags=["views", "activity", "logins"])
router.include_router(get_router)
