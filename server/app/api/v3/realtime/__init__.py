"""Realtime API endpoints."""

from app.api.v3.realtime.ephemeral_key import router as ephemeral_key_router
from fastapi import APIRouter

router = APIRouter(prefix="/realtime", tags=["realtime"])

# Include endpoint routers
router.include_router(ephemeral_key_router)

