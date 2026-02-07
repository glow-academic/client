"""Unified training analytics router (home + practice via practice: bool)."""

from fastapi import APIRouter

from app.api.v4.artifacts.training.docs import router as docs_router
from app.api.v4.artifacts.training.get import router as get_router
from app.api.v4.artifacts.training.refresh import router as refresh_router

router = APIRouter(prefix="/training", tags=["artifacts", "training"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(docs_router)
