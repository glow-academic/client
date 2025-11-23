"""Database logging middleware for FastAPI requests/responses.

Note: This middleware must remain separate as FastAPI requires middleware to be a class
inheriting from BaseHTTPMiddleware. The logic is minimal and focused on:
1. Extracting profile_id from request (body/headers)
2. Setting profile context for logging
3. Logging request/response to database
4. Recording metrics

This follows DHH principles - minimal abstraction, focused responsibility.
"""

import json
import time
from typing import Any

from app.utils.logging.db_logger import (get_logger, resolve_profile_id,
                                         set_profile_id)
from app.utils.metrics.collector import record_error, record_request
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = get_logger(__name__)


class DBLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that automatically logs all requests/responses to database."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Process request and log to database."""
        start_time = time.perf_counter()
        
        # Extract profile_id from request
        profile_id: str | None = None
        
        # Try to get from request body if JSON
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body = await request.body()
                if body:
                    body_json = json.loads(body)
                    # Common patterns: profileId, profile_id, actualProfileId, effectiveProfileId
                    profile_id = (
                        body_json.get("profileId")
                        or body_json.get("profile_id")
                        or body_json.get("actualProfileId")
                        or body_json.get("effectiveProfileId")
                    )
            except (json.JSONDecodeError, KeyError, AttributeError):
                pass
        
        # Try to get from headers
        if not profile_id:
            profile_id = request.headers.get("X-Profile-Id")
        
        # Resolve guest profile if needed
        if profile_id:
            try:
                resolved_id = await resolve_profile_id(profile_id)
                set_profile_id(resolved_id)
            except Exception as e:
                logger.warning(f"Error resolving profile_id: {e}")
                set_profile_id(None)
        else:
            # If no profile_id found, resolve to guest profile
            try:
                resolved_id = await resolve_profile_id("guest-profile-id")
                set_profile_id(resolved_id)
            except Exception:
                set_profile_id(None)
        
        # Process request
        status_code = 500
        error_msg: str | None = None
        try:
            response: Response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as exc:
            status_code = 500
            error_msg = str(exc)
            raise
        finally:
            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            # Record metrics (async, fire and forget)
            try:
                import asyncio
                if status_code >= 500:
                    asyncio.create_task(record_error())
                asyncio.create_task(record_request(duration_ms))
            except Exception:
                pass  # Don't break request if metrics fail
            
            # Log to database (fire and forget - don't block response)
            try:
                extra_data: dict[str, Any] = {
                    "method": request.method,
                    "path": str(request.url.path),
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                    "client": request.client.host if request.client else None,
                }
                if error_msg:
                    extra_data["error"] = error_msg
                
                # Use logger with extra data
                import logging
                log_level = logging.INFO if status_code < 500 else logging.ERROR
                log_message = f"{request.method} {request.url.path} -> {status_code} ({duration_ms:.2f}ms)"
                
                # Log directly with extra data
                logger.log(log_level, log_message, extra={"extra_data": extra_data})
            except Exception:
                # Never break the request because logging failed
                pass
            finally:
                # Clear profile_id from context
                set_profile_id(None)

