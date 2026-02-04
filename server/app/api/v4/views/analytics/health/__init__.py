"""Analytics health routes."""

from fastapi import APIRouter

from app.api.v4.views.analytics.health.get import router

__all__ = ["router"]
