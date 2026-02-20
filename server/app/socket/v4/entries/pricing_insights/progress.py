"""Pricing Insights entry progress handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.pricing_insights.types import PricingInsightsGenerationEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_progress(data: dict[str, Any]) -> None:
    """Pricing Insights generation progress - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {}

    event = PricingInsightsGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments_delta=data.get("arguments_delta"),
        **resolved_fields,
    )

    await sio.emit(
        "pricing_insights_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_progress")  # type: ignore
async def pricing_insights_call_progress_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_delta events targeting pricing_insights."""
    if data.get("event_type") != "tool_call_delta":
        return
    if resolve_entry_type(data) != "pricing_insights":
        return
    await handle_progress(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/pricing_insights_generation_progress")
async def pricing_insights_generation_progress_api(
    request: PricingInsightsGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Pricing Insights generation progress."""
    return {"success": True}
