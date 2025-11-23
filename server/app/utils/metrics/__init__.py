"""Metrics collection utilities (Redis-backed for multi-instance)."""

from app.utils.metrics.collector import (
    get_current_metrics,
    initialize_metrics,
    record_error,
    record_request,
    snapshot_metrics,
)

__all__ = [
    "initialize_metrics",
    "record_request",
    "record_error",
    "snapshot_metrics",
    "get_current_metrics",
]

# Note: record_request and record_error are now async functions
# Use await or asyncio.create_task() when calling them

