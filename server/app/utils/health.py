"""Health check utilities for system services (DHH-style plain functions)."""

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import asyncpg  # type: ignore
import httpx  # type: ignore
from app.main import (TUS_UPLOADS_DIR, get_pool, get_redis_client,
                      get_sio_instance)
from fastapi import status  # type: ignore


@dataclass
class ServiceCheckResult:
    """Result of a service health check."""

    ok: bool
    latency_ms: float
    error: str = ""


async def check_database(pool: asyncpg.Pool | None) -> ServiceCheckResult:
    """Check database connectivity with a simple SELECT query.

    Args:
        pool: Database connection pool

    Returns:
        ServiceCheckResult with ok status, latency, and error message
    """
    start = time.perf_counter()
    if pool is None:
        return ServiceCheckResult(False, 0.0, "no pool configured")

    try:
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        latency = (time.perf_counter() - start) * 1000
        return ServiceCheckResult(True, latency)
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return ServiceCheckResult(False, latency, str(e))


async def check_redis(redis_client: Any | None) -> ServiceCheckResult:
    """Check Redis connectivity with a PING command.

    Args:
        redis_client: Redis client instance

    Returns:
        ServiceCheckResult with ok status, latency, and error message
    """
    start = time.perf_counter()
    if redis_client is None:
        return ServiceCheckResult(False, 0.0, "redis disabled or not configured")

    try:
        pong = await redis_client.ping()
        latency = (time.perf_counter() - start) * 1000
        if pong:
            return ServiceCheckResult(True, latency)
        return ServiceCheckResult(False, latency, "PING returned falsy")
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return ServiceCheckResult(False, latency, str(e))


async def check_keycloak() -> ServiceCheckResult:
    """Check Keycloak availability via HTTP GET to .well-known endpoint.

    No admin client, no heavy logic - just a cheap outward-facing check.

    Returns:
        ServiceCheckResult with ok status, latency, and error message
    """
    start = time.perf_counter()
    keycloak_url = os.getenv("KEYCLOAK_URL", "http://localhost:8080").rstrip("/")
    realm = os.getenv("KEYCLOAK_REALM", "glow")
    well_known = f"{keycloak_url}/realms/{realm}/.well-known/openid-configuration"

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(well_known)
        latency = (time.perf_counter() - start) * 1000
        if r.status_code == 200:
            return ServiceCheckResult(True, latency)
        return ServiceCheckResult(False, latency, f"status={r.status_code}")
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return ServiceCheckResult(False, latency, str(e))


async def check_websocket() -> ServiceCheckResult:
    """Check WebSocket server instance health.

    DHH-style: no internal client dance. If the Socket.IO server instance
    exists and has handlers, we treat it as healthy. Network-level probing
    is the job of your proxy/load balancer.

    Returns:
        ServiceCheckResult with ok status, latency, and error message
    """
    start = time.perf_counter()
    try:
        sio = get_sio_instance()
        if sio is None:
            return ServiceCheckResult(False, 0.0, "no sio instance")

        # Very lightweight structural check - ensure at least one event handler is registered
        handlers = getattr(sio, "handlers", {})
        if not handlers:
            latency = (time.perf_counter() - start) * 1000
            return ServiceCheckResult(False, latency, "no websocket handlers registered")

        latency = (time.perf_counter() - start) * 1000
        return ServiceCheckResult(True, latency)
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return ServiceCheckResult(False, latency, str(e))


async def check_tus_workflow() -> ServiceCheckResult:
    """Check TUS upload workflow via HTTP canary upload.

    Full TUS workflow check via HTTP:
    - POST /upload (creation-with-upload)
    - HEAD /upload/{id} to verify

    Returns:
        ServiceCheckResult with ok status, latency, and error message
    """
    start = time.perf_counter()
    base_url = os.getenv("HEALTH_BASE_URL", "http://localhost:8000").rstrip("/")
    url = f"{base_url}/upload"

    # tiny "file"
    body = b"healthcheck"
    upload_length = str(len(body))

    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": upload_length,
        "Content-Type": "application/offset+octet-stream",
    }

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            # Creation-with-upload
            r = await client.post(url, headers=headers, content=body)
            if r.status_code != status.HTTP_201_CREATED:
                latency = (time.perf_counter() - start) * 1000
                return ServiceCheckResult(
                    False,
                    latency,
                    f"POST /upload -> {r.status_code}",
                )

            location = r.headers.get("Location")
            if not location:
                latency = (time.perf_counter() - start) * 1000
                return ServiceCheckResult(False, latency, "no Location header")

            if location.startswith("/"):
                upload_url = f"{base_url}{location}"
            else:
                upload_url = location

            # HEAD to verify info is consistent
            r_head = await client.head(upload_url, headers={"Tus-Resumable": "1.0.0"})
            if r_head.status_code != status.HTTP_200_OK:
                latency = (time.perf_counter() - start) * 1000
                return ServiceCheckResult(
                    False,
                    latency,
                    f"HEAD {upload_url} -> {r_head.status_code}",
                )

            offset = r_head.headers.get("Upload-Offset")
            length = r_head.headers.get("Upload-Length")

            if offset != upload_length or length != upload_length:
                latency = (time.perf_counter() - start) * 1000
                return ServiceCheckResult(
                    False,
                    latency,
                    f"offset/length mismatch offset={offset}, length={length}, expected={upload_length}",
                )

        latency = (time.perf_counter() - start) * 1000
        return ServiceCheckResult(True, latency)
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return ServiceCheckResult(False, latency, str(e))


async def run_service_checks() -> dict[str, ServiceCheckResult]:
    """Run all service health checks and return results.

    Returns:
        Dictionary mapping service names to their check results
    """
    pool = get_pool()
    redis_client = get_redis_client()

    db = await check_database(pool)
    redis = await check_redis(redis_client)
    keycloak = await check_keycloak()
    websocket = await check_websocket()
    tus = await check_tus_workflow()

    return {
        "database": db,
        "redis": redis,
        "keycloak": keycloak,
        "websocket": websocket,
        "tus": tus,
    }

