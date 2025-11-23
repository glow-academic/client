"""Middleware for FastAPI application."""

from app.middleware.db_logging import DBLoggingMiddleware

__all__ = ["DBLoggingMiddleware"]

