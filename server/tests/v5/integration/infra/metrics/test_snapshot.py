"""Integration tests for app.metrics.snapshot."""

from datetime import UTC, datetime

import asyncpg
import pytest

from app.metrics.snapshot import log_metrics_snapshot

pytestmark = pytest.mark.asyncio


class TestLogMetricsSnapshot:
    """Tests for log_metrics_snapshot function."""

    async def test_log_metrics_snapshot_success(self, db: asyncpg.Connection) -> None:
        """Test successful metrics snapshot logging."""
        # Arrange
        ts = datetime.now(UTC).replace(second=0, microsecond=0)
        requests_total = 100
        errors_total = 5
        avg_latency_ms = 50.5
        cpu_percent = 25.0
        memory_bytes = 1024 * 1024 * 512  # 512 MB

        # Act
        await log_metrics_snapshot(
            ts=ts,
            requests_total=requests_total,
            errors_total=errors_total,
            avg_latency_ms=avg_latency_ms,
            cpu_percent=cpu_percent,
            memory_bytes=memory_bytes,
            conn=db,
        )

        # Assert
        # Function should execute without error
        # Actual database insertion can be verified via SQL query if needed

    async def test_log_metrics_snapshot_zero_values(
        self, db: asyncpg.Connection
    ) -> None:
        """Test metrics snapshot logging with zero values."""
        # Arrange
        ts = datetime.now(UTC).replace(second=0, microsecond=0)

        # Act
        await log_metrics_snapshot(
            ts=ts,
            requests_total=0,
            errors_total=0,
            avg_latency_ms=0.0,
            cpu_percent=0.0,
            memory_bytes=0,
            conn=db,
        )

        # Assert
        # Function should execute without error
