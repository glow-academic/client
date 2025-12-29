"""OpenAPI documentation helpers for WebSocket endpoints."""

from typing import TypeVar

from fastapi import APIRouter
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def register_client_endpoint(
    router: APIRouter,
    path: str,
    request_type: type[T],
    description: str,
) -> None:
    """Register a client-to-server endpoint for OpenAPI documentation.
    
    All WebSocket client endpoints follow the same pattern:
    - POST method
    - Request body with typed model
    - Response: {"success": True}
    
    Args:
        router: FastAPI router to register endpoint on
        path: Endpoint path (e.g., "/generate")
        request_type: Auto-generated ApiRequest type
        description: Endpoint description for OpenAPI docs
    """
    @router.post(path, response_model=dict[str, bool])
    async def endpoint_handler(request: BaseModel) -> dict[str, bool]:  # type: ignore[arg-type]
        """Client-to-server event: {description}"""
        return {"success": True}
    
    # Update docstring with actual description
    endpoint_handler.__doc__ = f"Client-to-server event: {description}"


def register_server_endpoint(
    router: APIRouter,
    path: str,
    response_type: type[T],
    description: str,
) -> None:
    """Register a server-to-client endpoint for OpenAPI documentation.
    
    All WebSocket server endpoints follow the same pattern:
    - POST method
    - Request body with typed response model (what server sends to client)
    - Response: {"success": True}
    
    Args:
        router: FastAPI router to register endpoint on
        path: Endpoint path (e.g., "/generation_complete")
        response_type: Auto-generated SqlRow type (what server emits)
        description: Endpoint description for OpenAPI docs
    """
    @router.post(path, response_model=dict[str, bool])
    async def endpoint_handler(request: BaseModel) -> dict[str, bool]:  # type: ignore[arg-type]
        """Server-to-client event: {description}"""
        return {"success": True}
    
    # Update docstring with actual description
    endpoint_handler.__doc__ = f"Server-to-client event: {description}"

