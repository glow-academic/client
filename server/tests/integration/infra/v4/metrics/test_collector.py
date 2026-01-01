"""Integration tests for app.infra.v4.metrics.collector."""

import pytest

from app.infra.v4.metrics.collector import (
    initialize_metrics,
    record_error,
    record_request,
)
from app.main import get_pool, get_redis_client

pytestmark = pytest.mark.asyncio


class TestMetricsCollector:
    """Tests for metrics collector functions."""

    async def test_initialize_metrics_with_pool(self, db) -> None:
        """Test initialize_metrics with database pool."""
        # Arrange
        pool = get_pool()
        assert pool is not None
        redis_client = get_redis_client()

        # Act
        initialize_metrics(pool, redis_client)

        # Assert
        # Function should execute without error

    async def test_initialize_metrics_no_redis(self, db) -> None:
        """Test initialize_metrics without Redis."""
        # Arrange
        pool = get_pool()
        assert pool is not None

        # Act
        initialize_metrics(pool, None)

        # Assert
        # Function should execute without error

    async def test_record_request(self, db) -> None:
        """Test record_request function."""
        # Arrange
        pool = get_pool()
        assert pool is not None
        redis_client = get_redis_client()
        initialize_metrics(pool, redis_client)

        # Act
        await record_request(50.5)

        # Assert
        # Function should execute without error

    async def test_record_error(self, db) -> None:
        """Test record_error function."""
        # Arrange
        pool = get_pool()
        assert pool is not None
        redis_client = get_redis_client()
        initialize_metrics(pool, redis_client)

        # Act
        await record_error()

        # Assert
        # Function should execute without error

