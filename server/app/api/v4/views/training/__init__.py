"""Training views router."""

from fastapi import APIRouter

from app.api.v4.views.training.context import router as context_router

router = APIRouter(prefix="/training", tags=["views", "training"])

router.include_router(context_router)
