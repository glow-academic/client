"""Insights endpoint — stub (insight tables removed)."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.v4.auth.types import GetInsightsApiResponse

router = APIRouter()


@router.post("/insights", response_model=GetInsightsApiResponse)
async def get_insights(
    http_request: Request,
) -> GetInsightsApiResponse:
    """Return historical insights — currently returns empty (tables removed)."""
    return GetInsightsApiResponse(insights=[])
