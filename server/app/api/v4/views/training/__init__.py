"""Training views router."""

from fastapi import APIRouter

from app.api.v4.views.training.bundle import router as bundle_router
from app.api.v4.views.training.context import router as context_router

router = APIRouter(prefix="/training", tags=["views", "training"])

router.include_router(context_router)
router.include_router(bundle_router)
