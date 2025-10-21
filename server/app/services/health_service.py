"""Health check service - comprehensive system health monitoring."""

import asyncio
import os
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import asyncpg  # type: ignore
from app.db import get_pool
from app.extensions import UPLOAD_FOLDER
from app.queries.health_queries import HealthQueries
from app.schemas.health import HealthCheckItem, HealthResponse
from app.services.base_service import BaseService


class HealthService(BaseService):
    """Service for comprehensive system health checks."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize health service with database connection."""
        super().__init__(conn)
        self.queries = HealthQueries()

    async def get_system_health(
        self, origin: str | None = None, timeout: int = 30
    ) -> HealthResponse:
        """
        Run all health checks in parallel with timeout protection.

        Args:
            origin: Client URL (defaults to ORIGIN env var)
            timeout: Max seconds for all checks (default 30)

        Returns:
            HealthResponse with all check results
        """
        start_time = time.time()

        # Use env var if not provided
        if not origin:
            origin = os.getenv("ORIGIN", "http://localhost:3000")

        # Run all checks in parallel with return_exceptions to prevent failures from blocking
        results = await asyncio.gather(
            self.check_database(),
            self.check_redis(),
            self.check_websocket(),
            self.check_simulation_service(),
            self.check_assistant_service(),
            self.check_document_upload(),
            self.check_authentication(origin),
            self.check_client_api(origin),
            self.check_route_scan(origin),
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
                        last_checked=datetime.now(UTC).isoformat(),
                        error=str(result),
                    )
                )

        # Calculate overall system status
        from typing import Literal
        
        statuses = [check.status for check in checks]
        overall_status: Literal["healthy", "degraded", "unhealthy"]
        if "unhealthy" in statuses:
            overall_status = "unhealthy"
        elif "warning" in statuses:
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        overall_response_time = int((time.time() - start_time) * 1000)

        return HealthResponse(
            status=overall_status,
            checks=checks,
            timestamp=datetime.now(UTC).isoformat(),
            overall_response_time=overall_response_time,
        )

    async def check_database(self) -> HealthCheckItem:
        """Check database connectivity and pool utilization."""
        start = time.time()
        try:
            # Verify connection with simple query
            await self.conn.fetchval("SELECT 1")

            # Check pool utilization
            from typing import Literal
            
            status: Literal["healthy", "unhealthy", "warning", "n/a"]
            pool = get_pool()
            if pool:
                size = pool.get_size()
                free = pool.get_idle_size()
                utilization = (size - free) / size if size > 0 else 0

                # Warning at >80% utilization
                status = "warning" if utilization > 0.8 else "healthy"
                message = f"Pool: {size - free}/{size} ({utilization*100:.0f}% used)"
            else:
                status = "healthy"
                message = "Connected"

            return HealthCheckItem(
                id="database",
                name="Database Connection",
                description="PostgreSQL database connectivity",
                status=status,
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                message=message,
            )
        except Exception as e:
            return HealthCheckItem(
                id="database",
                name="Database Connection",
                description="PostgreSQL database connectivity",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )

    async def check_redis(self) -> HealthCheckItem:
        """Check Redis connectivity."""
        start = time.time()
        from app.extensions import redis_client

        if not redis_client:
            return HealthCheckItem(
                id="redis",
                name="Redis Connection",
                description="Redis for WebSocket scaling",
                status="warning",
                response_time=0,
                last_checked=datetime.now(UTC).isoformat(),
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
                last_checked=datetime.now(UTC).isoformat(),
                message="Connected",
            )
        except Exception as e:
            return HealthCheckItem(
                id="redis",
                name="Redis Connection",
                description="Redis for WebSocket scaling",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )

    async def check_websocket(self) -> HealthCheckItem:
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
                    last_checked=datetime.now(UTC).isoformat(),
                    error="Socket.IO instance not initialized",
                )

            # Check if manager is initialized
            manager = sio.manager if hasattr(sio, "manager") else None

            return HealthCheckItem(
                id="websocket",
                name="WebSocket Connection",
                description="Real-time communication service",
                status="healthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                message="Socket.IO server initialized",
            )
        except Exception as e:
            return HealthCheckItem(
                id="websocket",
                name="WebSocket Connection",
                description="Real-time communication service",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )

    async def check_simulation_service(self) -> HealthCheckItem:
        """Check simulation service with actual AI API call using GenericAgent."""
        start = time.time()
        try:
            # Get first active simulation agent with provider
            # Acquire separate connection to avoid concurrent operation error
            pool = get_pool()
            if not pool:
                return HealthCheckItem(
                    id="simulation-service",
                    name="Simulation Service",
                    description="Simulation AI agent functionality",
                    status="unhealthy",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    error="Database pool not available",
                )

            async with pool.acquire() as conn:
                query, params = self.queries.get_active_simulation_agent()
                agent = await conn.fetchrow(query, *params)

                if not agent:
                    return HealthCheckItem(
                        id="simulation-service",
                        name="Simulation Service",
                        description="Simulation AI agent functionality",
                        status="warning",
                        response_time=int((time.time() - start) * 1000),
                        last_checked=datetime.now(UTC).isoformat(),
                        message="No active simulation agents",
                    )

                # Use GenericAgent to test AI provider (like we do in actual agent runs)
                from app.agents.generic import GenericAgent

                generic_agent = GenericAgent(
                    agent_name=agent["name"],
                    system_prompt=agent["system_prompt"] or "You are a helpful assistant.",
                    temperature=agent["temperature"] or 0.7,
                    model_name=agent["model_name"],
                    model_provider=agent["provider_name"],
                    api_key=agent["api_key"],  # GenericAgent handles decryption
                    custom_model=agent["custom_model"],
                    base_url=agent["base_url"],
                    reasoning=agent["reasoning"],
                )

                # Create the agent instance - this validates provider connectivity
                agent_instance = generic_agent.agent()

                # If we get here without exception, provider is working
                return HealthCheckItem(
                    id="simulation-service",
                    name="Simulation Service",
                    description="Simulation AI agent functionality",
                    status="healthy",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    message=f"AI provider '{agent['provider_name']}' initialized",
                )

        except Exception as e:
            return HealthCheckItem(
                id="simulation-service",
                name="Simulation Service",
                description="Simulation AI agent functionality",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )

    async def check_assistant_service(self) -> HealthCheckItem:
        """Check assistant service with actual AI API call and MCP server using GenericAgent."""
        start = time.time()
        try:
            # Get first active assistant agent with provider
            # Acquire separate connection to avoid concurrent operation error
            pool = get_pool()
            if not pool:
                return HealthCheckItem(
                    id="assistant-service",
                    name="Assistant Service",
                    description="Assistant AI agent and tool functionality",
                    status="unhealthy",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    error="Database pool not available",
                )

            async with pool.acquire() as conn:
                query, params = self.queries.get_active_assistant_agent()
                agent = await conn.fetchrow(query, *params)

                if not agent:
                    return HealthCheckItem(
                        id="assistant-service",
                        name="Assistant Service",
                        description="Assistant AI agent and tool functionality",
                        status="warning",
                        response_time=int((time.time() - start) * 1000),
                        last_checked=datetime.now(UTC).isoformat(),
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
                    # Create agent instance - validates provider
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
                from typing import Literal
                
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
                    last_checked=datetime.now(UTC).isoformat(),
                    message=message,
                )

        except Exception as e:
            return HealthCheckItem(
                id="assistant-service",
                name="Assistant Service",
                description="Assistant AI agent and tool functionality",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )

    async def check_document_upload(self) -> HealthCheckItem:
        """Check document upload with full TUS protocol pipeline test (like client does)."""
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
                    last_checked=datetime.now(UTC).isoformat(),
                    error=f"Upload folder {UPLOAD_FOLDER} missing",
                )

            if not os.access(UPLOAD_FOLDER, os.W_OK):
                return HealthCheckItem(
                    id="document-upload",
                    name="Document Upload Service",
                    description="File upload and processing functionality",
                    status="unhealthy",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    error=f"Upload folder {UPLOAD_FOLDER} not writable",
                )

            # Test full TUS protocol pipeline (like client does)
            from app.services.document_service import DocumentService

            upload_id = None
            
            # Get connection from pool for DocumentService
            pool = get_pool()
            if not pool:
                return HealthCheckItem(
                    id="document-upload",
                    name="Document Upload Service",
                    description="File upload and processing functionality",
                    status="unhealthy",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    error="Database pool not available",
                )

            async with pool.acquire() as conn:
                doc_service = DocumentService(conn)

                # 1. Create TUS upload (like client POST /upload)
                test_content = b"Health check test content"
                test_metadata = {
                    "filename": "health_test.txt",
                    "filetype": "text/plain",
                    "fileId": f"health_test_{uuid.uuid4()}",
                }

                upload_id, location, offset = await doc_service.create_tus_upload(
                    str(len(test_content)), test_metadata, ""
                )

                # 2. Upload chunk (like client PATCH /upload/{id})
                success, new_offset, error = doc_service.append_tus_chunk(
                    upload_id, test_content, str(offset)
                )

                if not success:
                    return HealthCheckItem(
                        id="document-upload",
                        name="Document Upload Service",
                        description="File upload and processing functionality",
                        status="unhealthy",
                        response_time=int((time.time() - start) * 1000),
                        last_checked=datetime.now(UTC).isoformat(),
                        error=f"TUS chunk upload failed: {error}",
                    )

                # 3. Verify upload info (like client HEAD /upload/{id})
                upload_info = await doc_service.get_tus_upload_info(upload_id)
                if not upload_info:
                    return HealthCheckItem(
                        id="document-upload",
                        name="Document Upload Service",
                        description="File upload and processing functionality",
                        status="unhealthy",
                        response_time=int((time.time() - start) * 1000),
                        last_checked=datetime.now(UTC).isoformat(),
                        error="TUS upload info retrieval failed",
                    )

            # 4. Clean up TUS upload directory
            tus_uploads_dir = Path(UPLOAD_FOLDER) / "tus_uploads"
            upload_dir = tus_uploads_dir / upload_id
            if upload_dir.exists():
                import shutil
                shutil.rmtree(upload_dir)

            # Check disk space
            stat = os.statvfs(str(UPLOAD_FOLDER))
            free_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)

            from typing import Literal, cast
            
            status = "warning" if free_gb < 1 else "healthy"
            message = f"TUS protocol OK, {free_gb:.1f}GB free"

            return HealthCheckItem(
                id="document-upload",
                name="Document Upload Service",
                description="File upload and processing functionality",
                status=cast(Literal["healthy", "unhealthy", "warning", "n/a"], status),
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                message=message,
            )

        except Exception as e:
            # Clean up TUS upload on error
            if upload_id:
                try:
                    tus_uploads_dir = Path(UPLOAD_FOLDER) / "tus_uploads"
                    upload_dir = tus_uploads_dir / upload_id
                    if upload_dir.exists():
                        import shutil
                        shutil.rmtree(upload_dir)
                except Exception:
                    pass  # Ignore cleanup errors

            return HealthCheckItem(
                id="document-upload",
                name="Document Upload Service",
                description="File upload and processing functionality",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )

    async def check_authentication(self, origin: str) -> HealthCheckItem:
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
                    last_checked=datetime.now(UTC).isoformat(),
                    message=f"Auth endpoint responding ({response.status_code})",
                )
            else:
                return HealthCheckItem(
                    id="authentication",
                    name="Authentication Service",
                    description="User authentication and session management",
                    status="unhealthy",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    error=f"Unexpected status: {response.status_code}",
                )
        except Exception as e:
            return HealthCheckItem(
                id="authentication",
                name="Authentication Service",
                description="User authentication and session management",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )

    async def check_client_api(self, origin: str) -> HealthCheckItem:
        """Check client BFF API externally."""
        start = time.time()
        try:
            import httpx

            # Use a simple client endpoint (not the health endpoint to avoid circular dependency)
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{origin}/api/health")

            if response.status_code < 400:
                return HealthCheckItem(
                    id="client-api",
                    name="Client API",
                    description="Next.js API routes health",
                    status="healthy",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    message="Client BFF responding",
                )
            else:
                return HealthCheckItem(
                    id="client-api",
                    name="Client API",
                    description="Next.js API routes health",
                    status="unhealthy",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    error=f"HTTP {response.status_code}",
                )
        except Exception as e:
            return HealthCheckItem(
                id="client-api",
                name="Client API",
                description="Next.js API routes health",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )

    async def check_route_scan(self, origin: str) -> HealthCheckItem:
        """Check critical application routes externally."""
        start = time.time()
        # Curated list of critical routes
        routes = ["/", "/home", "/profile"]

        try:
            import httpx

            async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
                results = await asyncio.gather(
                    *[client.get(f"{origin}{route}") for route in routes],
                    return_exceptions=True,
                )

            import httpx
            
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
                    last_checked=datetime.now(UTC).isoformat(),
                    message=f"All {len(routes)} routes accessible",
                )
            else:
                return HealthCheckItem(
                    id="route-scan",
                    name="Route Scanner",
                    description="Application route accessibility check",
                    status="warning",
                    response_time=int((time.time() - start) * 1000),
                    last_checked=datetime.now(UTC).isoformat(),
                    message=f"Issues: {', '.join(failed_routes)}",
                )
        except Exception as e:
            return HealthCheckItem(
                id="route-scan",
                name="Route Scanner",
                description="Application route accessibility check",
                status="unhealthy",
                response_time=int((time.time() - start) * 1000),
                last_checked=datetime.now(UTC).isoformat(),
                error=str(e),
            )
