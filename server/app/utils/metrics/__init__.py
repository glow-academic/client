"""Metrics collection utilities (Redis-backed for multi-instance)."""

from app.infra.metrics.collector import (
    get_current_metrics,
    initialize_metrics,
    log_health_checks,
    log_metrics_snapshot,
    record_error,
    record_request,
)

__all__ = [
    "initialize_metrics",
    "record_request",
    "record_error",
    "log_metrics_snapshot",
    "log_health_checks",
    "get_current_metrics",
]

# Note: record_request and record_error are now async functions
# Use await or asyncio.create_task() when calling them
