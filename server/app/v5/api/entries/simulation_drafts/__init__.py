"""Simulation Drafts entry endpoints."""

from fastapi import APIRouter

from app.v5.api.entries.simulation_drafts.get import router as get_router
from app.v5.api.entries.simulation_drafts.refresh import router as refresh_router
from app.v5.api.entries.simulation_drafts.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
