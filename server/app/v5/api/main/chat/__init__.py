"""Unified chat analytics router (home + practice via practice: bool)."""

from fastapi import APIRouter

from app.v5.api.main.chat.docs import router as docs_router
from app.v5.api.main.chat.draft import router as draft_router
from app.v5.api.main.chat.get import router as get_router
from app.v5.api.main.chat.refresh import router as refresh_router

router = APIRouter(prefix="/chat", tags=["artifacts", "chat"])

router.include_router(get_router)
router.include_router(draft_router)
router.include_router(refresh_router)
router.include_router(docs_router)
