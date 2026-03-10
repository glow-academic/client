"""Centralized event delivery routers."""

from fastapi import APIRouter

from app.routes.v5.api.events.polling import router as polling_router
from app.routes.v5.api.events.stream import router as stream_router
from app.routes.v5.api.events.webhooks import router as webhooks_router

router = APIRouter(prefix="/events", tags=["events"])

router.include_router(polling_router)
router.include_router(stream_router)
router.include_router(webhooks_router)
