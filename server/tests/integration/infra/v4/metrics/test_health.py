"""Integration tests for app.infra.v4.metrics.health."""

from datetime import datetime, timezone

import asyncpg
import pytest

from app.infra.v4.metrics.health import log_service_health

pytestmark = pytest.mark.asyncio


class TestLogServiceHealth:
    """Tests for log_service_health function."""

    async def test_log_service_health_success(self, db: asyncpg.Connection) -> None:
        """Test successful service health logging."""
        # Arrange
        ts = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        service = "database"
        ok = True
        latency_ms = 10.5
        error = ""

        # Act
        await log_service_health(
            ts=ts,
            service=service,
            ok=ok,
            latency_ms=latency_ms,
            error=error,
            conn=db,
        )

        # Assert
        # Function should execute without error

    async def test_log_service_health_error(self, db: asyncpg.Connection) -> None:
        """Test service health logging with error."""
        # Arrange
        ts = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        service = "redis"
        ok = False
        latency_ms = 100.0
        error = "Connection timeout"

        # Act
        await log_service_health(
            ts=ts,
            service=service,
            ok=ok,
            latency_ms=latency_ms,
            error=error,
            conn=db,
        )

        # Assert
        # Function should execute without error
