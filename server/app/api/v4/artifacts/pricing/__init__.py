"""Pricing artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.pricing.get import router as get_router

router = APIRouter()
router.include_router(get_router)
