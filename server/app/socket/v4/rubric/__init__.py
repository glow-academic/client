"""Rubric page handlers - handles rubric-specific logic (standard groups) then routes to artifacts."""

from . import generate

__all__ = ["generate"]

client_router = generate.client_router
server_router = generate.server_router

