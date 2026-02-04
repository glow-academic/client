"""Group artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.group.get import router as get_router
from app.api.v4.artifacts.group.list import router as list_router

router = APIRouter(prefix="/group", tags=["artifacts", "group"])

router.include_router(get_router)
router.include_router(list_router)
