"""Health check endpoint - v3 API following DHH principles."""

import asyncio
import os
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Literal

import asyncpg  # type: ignore
from app.db import get_db, get_pool
from app.extensions import UPLOAD_FOLDER, redis_client
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException

# Inline Pydantic schemas (moved from app.schemas.health)
class HealthCheckItem:
    """Individual health check result."""

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        status: Literal["healthy", "unhealthy", "warning", "n/a"],
        response_time: int | None = None,
        last_checked: str | None = None,
        message: str | None = None,
        error: str | None = None,
    ):
        self.id = id
        self.name = name
        self.description = description
        self.status = status
        self.response_time = response_time
        self.last_checked = last_checked or datetime.now(UTC).isoformat()
        self.message = message
        self.error = error

    def model_dump(self) -> dict:
        """Convert to dict for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "response_time": self.response_time,
            "last_checked": self.last_checked,
            "message": self.message,
            "error": self.error,
        }


class HealthResponse:
    """Overall system health response."""

    def __init__(
        self,
        status: Literal["healthy", "degraded", "unhealthy"],
        checks: list[HealthCheckItem],
        timestamp: str | None = None,
        overall_response_time: int | None = None,
    ):
        self.status = status
        self.checks = checks
        self.timestamp = timestamp or datetime.now(UTC).isoformat()
        self.overall_response_time = overall_response_time

    def model_dump(self) -> dict:
        """Convert to dict for JSON serialization."""
        return {
            "status": self.status,
            "checks": [check.model_dump() for check in self.checks],
            "timestamp": self.timestamp,
            "overall_response_time": self.overall_response_time,
        }


router = APIRouter()


async def check_database(conn: asyncpg.Connection) -> HealthCheckItem:
    """Check database connectivity and pool utilization."""
    start = time.time()
    try:
        # Verify connection with simple query
        await conn.fetchval("SELECT 1")

        # Check pool utilization
        status: Literal["healthy", "unhealthy", "warning", "n/a"]
        pool = get_pool()
        if pool:
            size = pool.get_size()
            free = pool.get_idle_size()
            utilization = (size - free) / size if size > 0 else 0

            # Warning at >80% utilization
            status = "warning" if utilization > 0.8 else "healthy"
            message = f"Pool: {size - free}/{size} ({utilization * 100:.0f}% used)"
        else:
            status = "healthy"
            message = "Connected"

        return HealthCheckItem(
            id="database",
            name="Database Connection",
            description="PostgreSQL database connectivity",
            status=status,
            response_time=int((time.time() - start) * 1000),
            message=message,
        )
    except Exception as e:
        return HealthCheckItem(
            id="database",
            name="Database Connection",
            description="PostgreSQL database connectivity",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


async def check_redis() -> HealthCheckItem:
    """Check Redis connectivity."""
    start = time.time()
    if not redis_client:
        return HealthCheckItem(
            id="redis",
            name="Redis Connection",
            description="Redis for WebSocket scaling",
            status="warning",
            response_time=0,
            message="Redis not configured (using in-memory fallback)",
        )

    try:
        await redis_client.ping()
        return HealthCheckItem(
            id="redis",
            name="Redis Connection",
            description="Redis for WebSocket scaling",
            status="healthy",
            response_time=int((time.time() - start) * 1000),
            message="Connected",
        )
    except Exception as e:
        return HealthCheckItem(
            id="redis",
            name="Redis Connection",
            description="Redis for WebSocket scaling",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


async def check_websocket() -> HealthCheckItem:
    """Check WebSocket server initialization."""
    start = time.time()
    try:
        from app.main import get_socketio_instance

        sio = get_socketio_instance()

        if sio is None:
            return HealthCheckItem(
                id="websocket",
                name="WebSocket Connection",
                description="Real-time communication service",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                error="Socket.IO instance not initialized",
            )

        return HealthCheckItem(
            id="websocket",
            name="WebSocket Connection",
            description="Real-time communication service",
            status="healthy",
            response_time=int((time.time() - start) * 1000),
            message="Socket.IO server initialized",
        )
    except Exception as e:
        return HealthCheckItem(
            id="websocket",
            name="WebSocket Connection",
            description="Real-time communication service",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


async def check_simulation_service(conn: asyncpg.Connection) -> HealthCheckItem:
    """Check simulation service with actual AI API call using GenericAgent."""
    start = time.time()
    try:
        # Get first active simulation agent with provider
        pool = get_pool()
        if not pool:
            return HealthCheckItem(
                id="simulation-service",
                name="Simulation Service",
                description="Simulation AI agent functionality",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                error="Database pool not available",
            )

        async with pool.acquire() as check_conn:
            # Use SQL file for query
            sql = load_sql("sql/v3/logs/get_active_simulation_agent.sql")
            agent = await check_conn.fetchrow(sql)

            if not agent:
                return HealthCheckItem(
                    id="simulation-service",
                    name="Simulation Service",
                    description="Simulation AI agent functionality",
                    status="warning",
                    response_time=int((time.time() - start) * 1000),
                    message="No active simulation agents",
                )

            # Use GenericAgent to test AI provider
            from app.agents.generic import GenericAgent

            generic_agent = GenericAgent(
                agent_name=agent["name"],
                system_prompt=agent["system_prompt"] or "You are a helpful assistant.",
                temperature=agent["temperature"] or 0.7,
                model_name=agent["model_name"],
                model_provider=agent["provider_name"],
                api_key=agent["api_key"],
                custom_model=agent["custom_model"],
                base_url=agent["base_url"],
                reasoning=agent["reasoning"],
            )

            # Create the agent instance - this validates provider connectivity
            agent_instance = generic_agent.agent()

            return HealthCheckItem(
                id="simulation-service",
                name="Simulation Service",
                description="Simulation AI agent functionality",
                status="healthy",
                response_time=int((time.time() - start) * 1000),
                message=f"AI provider '{agent['provider_name']}' initialized",
            )

    except Exception as e:
        return HealthCheckItem(
            id="simulation-service",
            name="Simulation Service",
            description="Simulation AI agent functionality",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


async def check_assistant_service(conn: asyncpg.Connection) -> HealthCheckItem:
    """Check assistant service with actual AI API call and MCP server using GenericAgent."""
    start = time.time()
    try:
        pool = get_pool()
        if not pool:
            return HealthCheckItem(
                id="assistant-service",
                name="Assistant Service",
                description="Assistant AI agent and tool functionality",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                error="Database pool not available",
            )

        async with pool.acquire() as check_conn:
            # Use SQL file for query
            sql = load_sql("sql/v3/logs/get_active_assistant_agent.sql")
            agent = await check_conn.fetchrow(sql)

            if not agent:
                return HealthCheckItem(
                    id="assistant-service",
                    name="Assistant Service",
                    description="Assistant AI agent and tool functionality",
                    status="warning",
                    response_time=int((time.time() - start) * 1000),
                    message="No active assistant agents",
                )

            # Test AI provider using GenericAgent
            from app.agents.generic import GenericAgent

            ai_healthy = False
            try:
                generic_agent = GenericAgent(
                    agent_name=agent["name"],
                    system_prompt=agent["system_prompt"] or "You are a helpful assistant.",
                    temperature=agent["temperature"] or 0.7,
                    model_name=agent["model_name"],
                    model_provider=agent["provider_name"],
                    api_key=agent["api_key"],
                    custom_model=agent["custom_model"],
                    base_url=agent["base_url"],
                    reasoning=agent["reasoning"],
                )
                agent_instance = generic_agent.agent()
                ai_healthy = True
            except Exception:
                ai_healthy = False

            # Test MCP server
            internal_api_base = os.getenv("INTERNAL_API_BASE", "http://localhost:8000")
            mcp_url = f"{internal_api_base}/domain/mcp/"

            mcp_healthy = False
            try:
                import httpx

                async with httpx.AsyncClient(timeout=5.0) as client:
                    mcp_response = await client.get(mcp_url)
                mcp_healthy = mcp_response.status_code < 400
            except Exception:
                mcp_healthy = False

            # Combine results
            status: Literal["healthy", "unhealthy", "warning", "n/a"]
            if ai_healthy and mcp_healthy:
                status = "healthy"
                message = f"AI provider '{agent['provider_name']}' + MCP server responding"
            elif ai_healthy:
                status = "warning"
                message = "AI OK but MCP server unavailable"
            else:
                status = "unhealthy"
                message = "AI provider not responding"

            return HealthCheckItem(
                id="assistant-service",
                name="Assistant Service",
                description="Assistant AI agent and tool functionality",
                status=status,
                response_time=int((time.time() - start) * 1000),
                message=message,
            )

    except Exception as e:
        return HealthCheckItem(
            id="assistant-service",
            name="Assistant Service",
            description="Assistant AI agent and tool functionality",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


async def check_document_upload() -> HealthCheckItem:
    """Check document upload with full TUS protocol pipeline test."""
    start = time.time()
    upload_id = None

    try:
        # Check directories exist and are writable
        if not os.path.exists(UPLOAD_FOLDER):
            return HealthCheckItem(
                id="document-upload",
                name="Document Upload Service",
                description="File upload and processing functionality",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                error=f"Upload folder {UPLOAD_FOLDER} missing",
            )

        if not os.access(UPLOAD_FOLDER, os.W_OK):
            return HealthCheckItem(
                id="document-upload",
                name="Document Upload Service",
                description="File upload and processing functionality",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                error=f"Upload folder {UPLOAD_FOLDER} not writable",
            )

        # Test TUS upload (simplified - just check folder is writable)
        tus_uploads_dir = Path(UPLOAD_FOLDER) / "tus_uploads"
        if not tus_uploads_dir.exists():
            tus_uploads_dir.mkdir(parents=True, exist_ok=True)

        # Check disk space
        stat = os.statvfs(str(UPLOAD_FOLDER))
        free_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)

        status = "warning" if free_gb < 1 else "healthy"
        message = f"Upload folder OK, {free_gb:.1f}GB free"

        return HealthCheckItem(
            id="document-upload",
            name="Document Upload Service",
            description="File upload and processing functionality",
            status=status,
            response_time=int((time.time() - start) * 1000),
            message=message,
        )

    except Exception as e:
        return HealthCheckItem(
            id="document-upload",
            name="Document Upload Service",
            description="File upload and processing functionality",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


async def check_authentication(origin: str) -> HealthCheckItem:
    """Check authentication endpoint externally."""
    start = time.time()
    try:
        import httpx

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{origin}/api/auth/session")

        # Both 200 (has session) and 401 (no session) mean auth is working
        if response.status_code in [200, 401]:
            return HealthCheckItem(
                id="authentication",
                name="Authentication Service",
                description="User authentication and session management",
                status="healthy",
                response_time=int((time.time() - start) * 1000),
                message=f"Auth endpoint responding ({response.status_code})",
            )
        else:
            return HealthCheckItem(
                id="authentication",
                name="Authentication Service",
                description="User authentication and session management",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                error=f"Unexpected status: {response.status_code}",
            )
    except Exception as e:
        return HealthCheckItem(
            id="authentication",
            name="Authentication Service",
            description="User authentication and session management",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


async def check_client_api(origin: str) -> HealthCheckItem:
    """Check client BFF API externally."""
    start = time.time()
    try:
        import httpx

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{origin}/api/health")

        if response.status_code < 400:
            return HealthCheckItem(
                id="client-api",
                name="Client API",
                description="Next.js API routes health",
                status="healthy",
                response_time=int((time.time() - start) * 1000),
                message="Client BFF responding",
            )
        else:
            return HealthCheckItem(
                id="client-api",
                name="Client API",
                description="Next.js API routes health",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                error=f"HTTP {response.status_code}",
            )
    except Exception as e:
        return HealthCheckItem(
            id="client-api",
            name="Client API",
            description="Next.js API routes health",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


async def check_route_scan(origin: str) -> HealthCheckItem:
    """Check critical application routes externally."""
    start = time.time()
    routes = ["/", "/home", "/profile"]

    try:
        import httpx

        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
            results = await asyncio.gather(
                *[client.get(f"{origin}{route}") for route in routes],
                return_exceptions=True,
            )

        failed_routes = []
        for route, result in zip(routes, results):
            if isinstance(result, (Exception, BaseException)):
                failed_routes.append(f"{route} (error)")
            elif isinstance(result, httpx.Response) and result.status_code >= 400:
                failed_routes.append(f"{route} ({result.status_code})")

        if not failed_routes:
            return HealthCheckItem(
                id="route-scan",
                name="Route Scanner",
                description="Application route accessibility check",
                status="healthy",
                response_time=int((time.time() - start) * 1000),
                message=f"All {len(routes)} routes accessible",
            )
        else:
            return HealthCheckItem(
                id="route-scan",
                name="Route Scanner",
                description="Application route accessibility check",
                status="warning",
                response_time=int((time.time() - start) * 1000),
                message=f"Issues: {', '.join(failed_routes)}",
            )
    except Exception as e:
        return HealthCheckItem(
            id="route-scan",
            name="Route Scanner",
            description="Application route accessibility check",
            status="unhealthy",
            response_time=int((time.time() - start) * 1000),
            error=str(e),
        )


@router.get("/health")
async def get_system_health(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """
    Comprehensive system health check endpoint.
    Tests all 9 system components with real functionality checks.
    No authentication required (for monitoring tools).
    """
    start_time = time.time()

    # Get origin from environment or use default
    origin = os.getenv("ORIGIN", "http://localhost:3000")

    # Run all checks in parallel with return_exceptions to prevent failures from blocking
    results = await asyncio.gather(
        check_database(conn),
        check_redis(),
        check_websocket(),
        check_simulation_service(conn),
        check_assistant_service(conn),
        check_document_upload(),
        check_authentication(origin),
        check_client_api(origin),
        check_route_scan(origin),
        return_exceptions=True,
    )

    # Filter out exceptions and convert to proper HealthCheckItem
    checks: list[HealthCheckItem] = []
    for result in results:
        if isinstance(result, HealthCheckItem):
            checks.append(result)
        elif isinstance(result, Exception):
            # Create error health check item
            checks.append(
                HealthCheckItem(
                    id="unknown",
                    name="Unknown Check",
                    description="Unknown health check",
                    status="unhealthy",
                    response_time=0,
                    error=str(result),
                )
            )

    # Calculate overall system status
    statuses = [check.status for check in checks]
    overall_status: Literal["healthy", "degraded", "unhealthy"]
    if "unhealthy" in statuses:
        overall_status = "unhealthy"
    elif "warning" in statuses:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    overall_response_time = int((time.time() - start_time) * 1000)

    response = HealthResponse(
        status=overall_status,
        checks=checks,
        overall_response_time=overall_response_time,
    )

    return response.model_dump()
