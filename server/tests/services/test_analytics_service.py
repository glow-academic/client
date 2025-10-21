"""Tests for analytics service - refresh utilities only."""

from unittest.mock import AsyncMock

import pytest

from app.services.analytics_service import AnalyticsService


@pytest.mark.asyncio
async def test_refresh_materialized_view():
    """Test refreshing the analytics materialized view."""
    # Mock connection
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock()

    # Create service
    service = AnalyticsService(mock_conn)

    # Mock cache invalidation
    service._invalidate_cache = AsyncMock()

    # Execute refresh
    await service.refresh_materialized_view()

    # Verify query was executed
    mock_conn.execute.assert_called_once()
    query = mock_conn.execute.call_args[0][0]
    assert "REFRESH MATERIALIZED VIEW CONCURRENTLY analytics" in query

    # Verify cache was invalidated
    service._invalidate_cache.assert_called_once()
    invalidation_tags = service._invalidate_cache.call_args[0][0]
    assert len(invalidation_tags) == 1
    assert "analytics:v2:all" in invalidation_tags[0]
