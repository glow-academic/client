"""Training bundle view router."""

from fastapi import APIRouter

from app.api.v4.views.training.bundle.get import router as get_router

router = APIRouter(prefix="/bundle", tags=["views", "training", "bundle"])

router.include_router(get_router)
