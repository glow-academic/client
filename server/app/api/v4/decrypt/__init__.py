"""Decrypt router."""

from fastapi import APIRouter

from app.api.v4.decrypt.key import router as key_router

router = APIRouter(prefix="/decrypt", tags=["decrypt"])

router.include_router(key_router)
