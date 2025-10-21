"""Unit tests for health check service."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.health import HealthCheckItem, HealthResponse
from app.services.health_service import HealthService


@pytest.fixture
def mock_conn():
    """Create mock database connection."""
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=1)
    conn.fetchrow = AsyncMock()
    return conn


@pytest.fixture
def health_service(mock_conn):
    """Create health service instance."""
    return HealthService(mock_conn)


@pytest.mark.asyncio
async def test_check_database_healthy(health_service, mock_conn):
    """Test database check when healthy."""
    mock_conn.fetchval.return_value = 1

    with patch("app.services.health_service.get_pool") as mock_pool:
        pool = MagicMock()
        pool.get_size.return_value = 10
        pool.get_idle_size.return_value = 8
        mock_pool.return_value = pool

        result = await health_service.check_database()

        assert result.id == "database"
        assert result.status == "healthy"
        assert result.response_time is not None
        assert "20% used" in result.message


@pytest.mark.asyncio
async def test_check_database_warning_high_utilization(health_service, mock_conn):
    """Test database check warns on high pool utilization."""
    mock_conn.fetchval.return_value = 1

    with patch("app.services.health_service.get_pool") as mock_pool:
        pool = MagicMock()
        pool.get_size.return_value = 10
        pool.get_idle_size.return_value = 1  # 90% used
        mock_pool.return_value = pool

        result = await health_service.check_database()

        assert result.status == "warning"
        assert "90% used" in result.message


@pytest.mark.asyncio
async def test_check_database_unhealthy(health_service, mock_conn):
    """Test database check when connection fails."""
    mock_conn.fetchval.side_effect = Exception("Connection failed")

    result = await health_service.check_database()

    assert result.status == "unhealthy"
    assert "Connection failed" in result.error


@pytest.mark.asyncio
async def test_check_redis_not_configured(health_service):
    """Test Redis check when not configured."""
    with patch("app.services.health_service.redis_client", None):
        result = await health_service.check_redis()

        assert result.id == "redis"
        assert result.status == "warning"
        assert "not configured" in result.message


@pytest.mark.asyncio
async def test_check_redis_healthy(health_service):
    """Test Redis check when healthy."""
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock()

    with patch("app.services.health_service.redis_client", mock_redis):
        result = await health_service.check_redis()

        assert result.status == "healthy"
        mock_redis.ping.assert_called_once()


@pytest.mark.asyncio
async def test_check_redis_unhealthy(health_service):
    """Test Redis check when connection fails."""
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock(side_effect=Exception("Redis down"))

    with patch("app.services.health_service.redis_client", mock_redis):
        result = await health_service.check_redis()

        assert result.status == "unhealthy"
        assert "Redis down" in result.error


@pytest.mark.asyncio
async def test_check_websocket_healthy(health_service):
    """Test WebSocket check when healthy."""
    mock_sio = MagicMock()
    mock_sio.manager = MagicMock()

    with patch("app.services.health_service.get_socketio_instance") as mock_get_sio:
        mock_get_sio.return_value = mock_sio

        result = await health_service.check_websocket()

        assert result.status == "healthy"
        assert result.id == "websocket"


@pytest.mark.asyncio
async def test_check_websocket_unhealthy(health_service):
    """Test WebSocket check when not initialized."""
    with patch("app.services.health_service.get_socketio_instance") as mock_get_sio:
        mock_get_sio.return_value = None

        result = await health_service.check_websocket()

        assert result.status == "unhealthy"
        assert "not initialized" in result.error


@pytest.mark.asyncio
async def test_check_simulation_service_no_agents(health_service, mock_conn):
    """Test simulation check when no agents exist."""
    mock_conn.fetchrow.return_value = None

    result = await health_service.check_simulation_service()

    assert result.status == "warning"
    assert "No active simulation agents" in result.message


@pytest.mark.asyncio
async def test_check_document_upload_healthy(health_service):
    """Test document upload check when healthy."""
    with (
        patch("app.services.health_service.os.path.exists", return_value=True),
        patch("app.services.health_service.os.access", return_value=True),
        patch("app.services.health_service.Path") as mock_path,
        patch("app.services.health_service.os.statvfs") as mock_statvfs,
    ):
        # Mock file operations
        test_file = MagicMock()
        test_file.exists.return_value = True
        test_file.read_text.return_value = "test content"
        test_file.unlink = MagicMock()
        mock_path.return_value.__truediv__.return_value = test_file

        # Mock disk space (5GB free)
        stat_result = MagicMock()
        stat_result.f_bavail = 5 * 1024**3
        stat_result.f_frsize = 1
        mock_statvfs.return_value = stat_result

        result = await health_service.check_document_upload()

        assert result.status == "healthy"
        assert "5.0GB free" in result.message


@pytest.mark.asyncio
async def test_check_authentication_healthy(health_service):
    """Test authentication check when endpoint responds."""

    mock_response = MagicMock()
    mock_response.status_code = 200

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_response
        )

        result = await health_service.check_authentication("http://localhost:3000")

        assert result.status == "healthy"
        assert "200" in result.message


@pytest.mark.asyncio
async def test_get_system_health_integration(health_service, mock_conn):
    """Test full system health check."""
    mock_conn.fetchval.return_value = 1
    mock_conn.fetchrow.return_value = None  # No agents

    with (
        patch("app.services.health_service.get_pool") as mock_pool,
        patch("app.services.health_service.redis_client", None),
        patch("app.services.health_service.get_socketio_instance") as mock_sio,
        patch("app.services.health_service.os.path.exists", return_value=True),
        patch("app.services.health_service.os.access", return_value=True),
        patch("httpx.AsyncClient") as mock_client,
    ):
        # Setup mocks
        pool = MagicMock()
        pool.get_size.return_value = 10
        pool.get_idle_size.return_value = 8
        mock_pool.return_value = pool

        mock_sio.return_value = MagicMock()

        # Mock HTTP responses
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_response
        )

        # Mock file operations for document upload
        with (
            patch("app.services.health_service.Path") as mock_path,
            patch("app.services.health_service.os.statvfs") as mock_statvfs,
        ):
            test_file = MagicMock()
            test_file.exists.return_value = True
            test_file.read_text.return_value = "test"
            test_file.unlink = MagicMock()
            mock_path.return_value.__truediv__.return_value = test_file

            stat_result = MagicMock()
            stat_result.f_bavail = 5 * 1024**3
            stat_result.f_frsize = 1
            mock_statvfs.return_value = stat_result

            result = await health_service.get_system_health()

            assert isinstance(result, HealthResponse)
            assert result.status in ["healthy", "degraded", "unhealthy"]
            assert len(result.checks) == 9
            assert result.overall_response_time > 0


@pytest.mark.asyncio
async def test_system_health_degraded_status(health_service, mock_conn):
    """Test that system reports degraded when warnings present."""
    # Mock database to return warning status
    mock_conn.fetchval.return_value = 1

    with patch("app.services.health_service.get_pool") as mock_pool:
        pool = MagicMock()
        pool.get_size.return_value = 10
        pool.get_idle_size.return_value = 1  # High utilization -> warning
        mock_pool.return_value = pool

        # Mock other checks to be mocked/skipped
        with (
            patch.object(health_service, "check_redis") as mock_redis,
            patch.object(health_service, "check_websocket") as mock_ws,
            patch.object(health_service, "check_simulation_service") as mock_sim,
            patch.object(health_service, "check_assistant_service") as mock_asst,
            patch.object(health_service, "check_document_upload") as mock_doc,
            patch.object(health_service, "check_authentication") as mock_auth,
            patch.object(health_service, "check_client_api") as mock_client,
            patch.object(health_service, "check_route_scan") as mock_routes,
        ):
            # All other checks healthy
            mock_redis.return_value = HealthCheckItem(
                id="redis",
                name="Redis",
                description="",
                status="healthy",
                response_time=10,
                last_checked=datetime.now(UTC).isoformat(),
            )
            mock_ws.return_value = HealthCheckItem(
                id="websocket",
                name="WebSocket",
                description="",
                status="healthy",
                response_time=10,
                last_checked=datetime.now(UTC).isoformat(),
            )
            mock_sim.return_value = HealthCheckItem(
                id="simulation-service",
                name="Simulation",
                description="",
                status="healthy",
                response_time=10,
                last_checked=datetime.now(UTC).isoformat(),
            )
            mock_asst.return_value = HealthCheckItem(
                id="assistant-service",
                name="Assistant",
                description="",
                status="healthy",
                response_time=10,
                last_checked=datetime.now(UTC).isoformat(),
            )
            mock_doc.return_value = HealthCheckItem(
                id="document-upload",
                name="Documents",
                description="",
                status="healthy",
                response_time=10,
                last_checked=datetime.now(UTC).isoformat(),
            )
            mock_auth.return_value = HealthCheckItem(
                id="authentication",
                name="Auth",
                description="",
                status="healthy",
                response_time=10,
                last_checked=datetime.now(UTC).isoformat(),
            )
            mock_client.return_value = HealthCheckItem(
                id="client-api",
                name="Client",
                description="",
                status="healthy",
                response_time=10,
                last_checked=datetime.now(UTC).isoformat(),
            )
            mock_routes.return_value = HealthCheckItem(
                id="route-scan",
                name="Routes",
                description="",
                status="healthy",
                response_time=10,
                last_checked=datetime.now(UTC).isoformat(),
            )

            result = await health_service.get_system_health()

            # Should be degraded due to database warning
            assert result.status == "degraded"
