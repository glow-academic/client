"""Simulation message_tree view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.message_tree.get import router as get_router
from app.api.v4.views.simulation.message_tree.recreate import router as recreate_router
from app.api.v4.views.simulation.message_tree.refresh import router as refresh_router

router = APIRouter(prefix="/message_tree", tags=["views", "simulation", "message_tree"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
