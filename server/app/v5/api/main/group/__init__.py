"""Group artifact router."""

from fastapi import APIRouter

from app.v5.api.main.group.docs import router as docs_router
from app.v5.api.main.group.get import router as get_router

router = APIRouter(prefix="/group", tags=["artifacts", "group"])

router.include_router(get_router)
router.include_router(docs_router)
