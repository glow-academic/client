"""Training views router."""

from fastapi import APIRouter

from app.api.v4.views.training.bundle import router as bundle_router

router = APIRouter(prefix="/training", tags=["views", "training"])

router.include_router(bundle_router)
