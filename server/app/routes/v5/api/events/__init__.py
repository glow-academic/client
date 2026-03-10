"""Centralized event delivery router accessors."""

from __future__ import annotations

from fastapi import APIRouter

_router: APIRouter | None = None


def get_router() -> APIRouter:
    """Build the events router lazily to avoid package import cycles."""
    global _router
    if _router is not None:
        return _router

    from app.routes.v5.api.events.polling import router as polling_router
    from app.routes.v5.api.events.stream import router as stream_router
    from app.routes.v5.api.events.webhooks import router as webhooks_router

    router = APIRouter(prefix="/events", tags=["events"])
    router.include_router(polling_router)
    router.include_router(stream_router)
    router.include_router(webhooks_router)
    _router = router
    return router
