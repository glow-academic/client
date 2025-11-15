"""Store the events iterator (async generator) to allow aclose() on cancel."""

from typing import Any

from app.main import get_active_results_dict


async def store_active_events(chat_id: str, events_iter: Any) -> None:
    """Store the events iterator (async generator) to allow aclose() on cancel."""
    active_results = get_active_results_dict()
    if chat_id not in active_results:
        active_results[chat_id] = {}
    active_results[chat_id]["events"] = events_iter
