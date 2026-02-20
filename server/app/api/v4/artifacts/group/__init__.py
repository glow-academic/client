"""Group artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.group.docs import router as docs_router
from app.api.v4.artifacts.group.get import router as get_router

router = APIRouter(prefix="/group", tags=["artifacts", "group"])

router.include_router(get_router)
router.include_router(docs_router)
