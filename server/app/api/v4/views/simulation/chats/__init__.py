"""Simulation chats view router."""

from fastapi import APIRouter

from app.api.v4.views.simulation.chats.get import router as get_router
from app.api.v4.views.simulation.chats.recreate import router as recreate_router
from app.api.v4.views.simulation.chats.refresh import router as refresh_router

router = APIRouter(prefix="/chats", tags=["views", "simulation", "chats"])

router.include_router(get_router)
router.include_router(refresh_router)
router.include_router(recreate_router)
